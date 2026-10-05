package com.inkwell.mobile.spatial

import com.inkwell.mobile.models.*
import kotlin.math.abs
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min

class SpatialAlignmentEngine {

    private var referenceFrame: DrawingReferenceFrame? = null
    private var registeredNodes: List<GraphNode> = emptyList()
    private val overlayStates = mutableMapOf<String, LiveNodeOverlayState>()
    private var lastTelemetry: TelemetryResponse? = null
    private var currentStatus: AlignmentStatus = AlignmentStatus.UNINITIALIZED
    private var alignmentConfidence: Double = 0.0

    fun setReference(frame: DrawingReferenceFrame, nodes: List<GraphNode>) {
        this.referenceFrame = frame
        this.registeredNodes = nodes
        this.currentStatus = AlignmentStatus.ALIGNED
        this.alignmentConfidence = 0.95
    }

    fun hasReference(): Boolean = referenceFrame != null && registeredNodes.isNotEmpty()

    fun getStatus(): AlignmentStatus = currentStatus
    fun getConfidence(): Double = alignmentConfidence

    /**
     * Computes the planar perspective projection from the captured reference drawing
     * into current CameraX viewport dimensions.
     */
    fun computeAlignment(
        viewWidth: Float,
        viewHeight: Float,
        liveCorners: FloatArray? = null
    ): List<LiveNodeOverlayState> {
        val frame = referenceFrame ?: return emptyList()

        if (viewWidth <= 0f || viewHeight <= 0f) return emptyList()

        // 1. Establish source 4 corners in reference image coordinate space [TL, TR, BR, BL]
        val srcCorners = if (frame.corners.size == 4) {
            floatArrayOf(
                frame.corners[0].x.toFloat(), frame.corners[0].y.toFloat(),
                frame.corners[1].x.toFloat(), frame.corners[1].y.toFloat(),
                frame.corners[2].x.toFloat(), frame.corners[2].y.toFloat(),
                frame.corners[3].x.toFloat(), frame.corners[3].y.toFloat()
            )
        } else {
            val b = frame.bounds
            floatArrayOf(
                b.x.toFloat(), b.y.toFloat(),
                (b.x + b.width).toFloat(), b.y.toFloat(),
                (b.x + b.width).toFloat(), (b.y + b.height).toFloat(),
                b.x.toFloat(), (b.y + b.height).toFloat()
            )
        }

        val srcW = hypot((srcCorners[2] - srcCorners[0]).toDouble(), (srcCorners[3] - srcCorners[1]).toDouble())
        val srcH = hypot((srcCorners[6] - srcCorners[0]).toDouble(), (srcCorners[7] - srcCorners[1]).toDouble())
        val srcAspect = srcW / max(1.0, srcH)

        // 2. Target 4 corners in screen viewport space
        val dstCorners = if (liveCorners != null && liveCorners.size == 8) {
            liveCorners
        } else {
            val availW = viewWidth * 0.88f
            val availH = viewHeight * 0.75f
            val fitW = minOf(availW, (availH * srcAspect).toFloat())
            val fitH = fitW / srcAspect.toFloat()
            val startX = (viewWidth - fitW) / 2f
            val startY = (viewHeight - fitH) / 2f
            floatArrayOf(
                startX, startY,
                startX + fitW, startY,
                startX + fitW, startY + fitH,
                startX, startY + fitH
            )
        }

        // 3. Evaluate alignment validity and confidence
        val eval = evaluateGeometry(srcCorners, dstCorners, viewWidth, viewHeight)
        this.alignmentConfidence = eval.confidence
        if (!eval.isValid) {
            this.currentStatus = AlignmentStatus.REFERENCE_LOST
            return emptyList()
        }
        this.currentStatus = if (eval.confidence >= 0.7) AlignmentStatus.ALIGNED else AlignmentStatus.LOW_CONFIDENCE

        // 4. Compute 3x3 planar perspective homography matrix using DLT algorithm
        val H = try {
            computePlanarHomography(srcCorners, dstCorners)
        } catch (e: Exception) {
            this.currentStatus = AlignmentStatus.REFERENCE_LOST
            return emptyList()
        }

        // 5. Map each recognized node from reference coordinates to live screen coordinates
        val results = mutableListOf<LiveNodeOverlayState>()
        val servicesMap = lastTelemetry?.services?.associateBy { it.nodeId } ?: emptyMap()

        for (node in registeredNodes) {
            val region = frame.nodeRegions[node.id] ?: NodeBoundingBox(
                node.position.x, node.position.y, node.width, node.height
            )

            // Project 4 corners of the node bounding box through H
            val (tlX, tlY) = projectPoint(H, region.x.toFloat(), region.y.toFloat())
            val (trX, trY) = projectPoint(H, (region.x + region.width).toFloat(), region.y.toFloat())
            val (brX, brY) = projectPoint(H, (region.x + region.width).toFloat(), (region.y + region.height).toFloat())
            val (blX, blY) = projectPoint(H, region.x.toFloat(), (region.y + region.height).toFloat())

            val screenMinX = minOf(tlX, trX, brX, blX)
            val screenMaxX = maxOf(tlX, trX, brX, blX)
            val screenMinY = minOf(tlY, trY, brY, blY)
            val screenMaxY = maxOf(tlY, trY, brY, blY)

            val service = servicesMap[node.id]
            val isHealthy = service != null && service.healthStatus == "healthy" && service.containerState == "running"
            val status = when {
                service == null -> "UNKNOWN"
                isHealthy -> "HEALTHY"
                else -> "DOWN"
            }

            val details = when {
                service == null -> "Waiting for telemetry"
                isHealthy -> "HTTP ${service.httpStatus ?: 200}" + (service.latencyMs?.let { " | ${String.format("%.1f", it)}ms" } ?: "")
                else -> service.error ?: "Offline"
            }

            val overlay = LiveNodeOverlayState(
                nodeId = node.id,
                type = node.type,
                label = node.label,
                screenX = screenMinX,
                screenY = screenMinY,
                screenWidth = screenMaxX - screenMinX,
                screenHeight = screenMaxY - screenMinY,
                status = status,
                latencyMs = service?.latencyMs,
                details = details
            )
            overlayStates[node.id] = overlay
            results.add(overlay)
        }

        return results
    }

    fun updateTelemetry(telemetry: TelemetryResponse) {
        this.lastTelemetry = telemetry
    }

    companion object {
        /**
         * Computes a 3x3 planar homography matrix mapping 4 points from src to dst
         */
        fun computePlanarHomography(src: FloatArray, dst: FloatArray): FloatArray {
            val A = Array(8) { FloatArray(8) }
            val b = FloatArray(8)

            for (i in 0 until 4) {
                val x = src[i * 2]
                val y = src[i * 2 + 1]
                val u = dst[i * 2]
                val v = dst[i * 2 + 1]

                // Row 1
                A[i * 2][0] = x
                A[i * 2][1] = y
                A[i * 2][2] = 1f
                A[i * 2][3] = 0f
                A[i * 2][4] = 0f
                A[i * 2][5] = 0f
                A[i * 2][6] = -u * x
                A[i * 2][7] = -u * y
                b[i * 2] = u

                // Row 2
                A[i * 2 + 1][0] = 0f
                A[i * 2 + 1][1] = 0f
                A[i * 2 + 1][2] = 0f
                A[i * 2 + 1][3] = x
                A[i * 2 + 1][4] = y
                A[i * 2 + 1][5] = 1f
                A[i * 2 + 1][6] = -v * x
                A[i * 2 + 1][7] = -v * y
                b[i * 2 + 1] = v
            }

            val h = solve8x8(A, b)
            return floatArrayOf(
                h[0], h[1], h[2],
                h[3], h[4], h[5],
                h[6], h[7], 1f
            )
        }

        fun projectPoint(H: FloatArray, x: Float, y: Float): Pair<Float, Float> {
            val xp = H[0] * x + H[1] * y + H[2]
            val yp = H[3] * x + H[4] * y + H[5]
            val wp = H[6] * x + H[7] * y + H[8]
            val w = if (abs(wp) < 1e-6f) 1e-6f else wp
            return Pair(xp / w, yp / w)
        }

        private fun solve8x8(A: Array<FloatArray>, b: FloatArray): FloatArray {
            val n = 8
            val M = Array(n) { i -> FloatArray(n + 1) { j -> if (j < n) A[i][j] else b[i] } }

            for (i in 0 until n) {
                var maxRow = i
                for (k in i + 1 until n) {
                    if (abs(M[k][i]) > abs(M[maxRow][i])) {
                        maxRow = k
                    }
                }

                val temp = M[i]
                M[i] = M[maxRow]
                M[maxRow] = temp

                if (abs(M[i][i]) < 1e-9f) {
                    throw IllegalStateException("Collinear or degenerate geometry")
                }

                for (k in 0 until n) {
                    if (k != i) {
                        val factor = M[k][i] / M[i][i]
                        for (j in i..n) {
                            M[k][j] -= factor * M[i][j]
                        }
                    }
                }
            }

            return FloatArray(n) { i -> M[i][n] / M[i][i] }
        }
    }

    private data class EvalResult(val confidence: Double, val isValid: Boolean, val reason: String? = null)

    private fun evaluateGeometry(
        src: FloatArray,
        dst: FloatArray,
        viewW: Float,
        viewH: Float
    ): EvalResult {
        var area = 0.0
        for (i in 0 until 4) {
            val j = (i + 1) % 4
            area += dst[i * 2] * dst[j * 2 + 1] - dst[j * 2] * dst[i * 2 + 1]
        }
        area = abs(area) / 2.0

        val screenArea = viewW * viewH
        if (area < screenArea * 0.04) {
            return EvalResult(0.2, false, "Drawing too far / small")
        }

        val srcW = hypot((src[2] - src[0]).toDouble(), (src[3] - src[1]).toDouble())
        val srcH = hypot((src[6] - src[0]).toDouble(), (src[7] - src[1]).toDouble())
        val dstW = hypot((dst[2] - dst[0]).toDouble(), (dst[3] - dst[1]).toDouble())
        val dstH = hypot((dst[6] - dst[0]).toDouble(), (dst[7] - dst[1]).toDouble())

        val srcAspect = srcW / max(1.0, srcH)
        val dstAspect = dstW / max(1.0, dstH)
        val aspectDev = abs(srcAspect - dstAspect) / srcAspect

        if (aspectDev > 0.70) {
            return EvalResult(0.3, false, "Distorted perspective")
        }

        val conf = max(0.5, min(0.98, 1.0 - aspectDev * 0.4))
        return EvalResult(conf, true)
    }
}
