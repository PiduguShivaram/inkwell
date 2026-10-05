package com.inkwell.mobile.views

import android.content.Context
import android.graphics.*
import android.util.AttributeSet
import android.view.View
import com.inkwell.mobile.models.AlignmentStatus
import com.inkwell.mobile.models.LiveNodeOverlayState

class DrawingOverlayView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : View(context, attrs, defStyleAttr) {

    private var nodeOverlays: List<LiveNodeOverlayState> = emptyList()
    private var alignmentStatus: AlignmentStatus = AlignmentStatus.UNINITIALIZED
    private var alignmentConfidence: Double = 0.0
    private var customMessage: String? = null

    // Paint configurations
    private val boxBorderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = 5f
    }

    private val boxFillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
    }

    private val badgeBgPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
    }

    private val textHeaderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        textSize = 28f
        typeface = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
    }

    private val textStatusPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        textSize = 24f
        typeface = Typeface.create(Typeface.MONOSPACE, Typeface.NORMAL)
    }

    private val hudBannerBg = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
    }

    private val hudBannerText = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        textSize = 30f
        typeface = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
        textAlign = Paint.Align.CENTER
    }

    fun updateOverlays(
        overlays: List<LiveNodeOverlayState>,
        status: AlignmentStatus,
        confidence: Double,
        message: String? = null
    ) {
        this.nodeOverlays = overlays
        this.alignmentStatus = status
        this.alignmentConfidence = confidence
        this.customMessage = message
        invalidate()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)

        if (width <= 0 || height <= 0) return

        // 1. Top HUD Banner
        drawHudBanner(canvas)

        // 2. If Reference is lost or uninitialized, draw realignment guide
        if (alignmentStatus == AlignmentStatus.REFERENCE_LOST || alignmentStatus == AlignmentStatus.UNINITIALIZED) {
            drawRealignGuide(canvas)
            return
        }

        // 3. Render Node Overlays over the physical paper sketch
        for (node in nodeOverlays) {
            drawNodeOverlay(canvas, node)
        }
    }

    private fun drawHudBanner(canvas: Canvas) {
        val bannerH = 70f
        val rect = RectF(20f, 20f, width - 20f, 20f + bannerH)

        val (bgColor, text) = when (alignmentStatus) {
            AlignmentStatus.ALIGNED -> {
                Color.parseColor("#E6064E3B") to "● RUNTIME LINKED: THE DRAWING IS THE DASHBOARD (${(alignmentConfidence * 100).toInt()}%)"
            }
            AlignmentStatus.LOW_CONFIDENCE -> {
                Color.parseColor("#E6D97706") to "▲ PARTIALLY ALIGNED (${(alignmentConfidence * 100).toInt()}%)"
            }
            AlignmentStatus.REFERENCE_LOST -> {
                Color.parseColor("#E6B91C1C") to "⚠️ REALIGN DRAWING / REFERENCE LOST"
            }
            AlignmentStatus.UNINITIALIZED -> {
                Color.parseColor("#E6334155") to "INSPECTION READY — SCAN SKETCH TO LINK"
            }
        }

        hudBannerBg.color = bgColor
        canvas.drawRoundRect(rect, 16f, 16f, hudBannerBg)
        canvas.drawText(customMessage ?: text, width / 2f, 20f + bannerH / 2f + 10f, hudBannerText)
    }

    private fun drawRealignGuide(canvas: Canvas) {
        val guidePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.parseColor("#80FFFFFF")
            style = Paint.Style.STROKE
            strokeWidth = 3f
            pathEffect = DashPathEffect(floatArrayOf(20f, 10f), 0f)
        }

        val padX = width * 0.08f
        val padY = height * 0.15f
        val frameRect = RectF(padX, padY, width - padX, height - padY)
        canvas.drawRoundRect(frameRect, 24f, 24f, guidePaint)
    }

    private fun drawNodeOverlay(canvas: Canvas, node: LiveNodeOverlayState) {
        val isHealthy = node.status == "HEALTHY"
        val isDown = node.status == "DOWN"

        val borderColor = when {
            isHealthy -> Color.parseColor("#10B981") // Emerald Green
            isDown -> Color.parseColor("#EF4444")    // Crimson Red
            else -> Color.parseColor("#94A3B8")      // Slate Neutral
        }

        val fillColor = when {
            isHealthy -> Color.parseColor("#1A10B981") // 10% translucent green
            isDown -> Color.parseColor("#26EF4444")    // 15% translucent red
            else -> Color.parseColor("#1A94A3B8")      // 10% translucent slate
        }

        val badgeBg = when {
            isHealthy -> Color.parseColor("#E6064E3B") // Dark emerald
            isDown -> Color.parseColor("#E67F1D1D")    // Dark red
            else -> Color.parseColor("#E61E293B")      // Dark slate
        }

        // Bounding box over paper sketch
        val rect = RectF(
            node.screenX,
            node.screenY,
            node.screenX + node.screenWidth,
            node.screenY + node.screenHeight
        )

        boxFillPaint.color = fillColor
        boxBorderPaint.color = borderColor

        // Draw translucent fill and crisp border (physical drawing is clearly visible inside)
        canvas.drawRoundRect(rect, 16f, 16f, boxFillPaint)
        canvas.drawRoundRect(rect, 16f, 16f, boxBorderPaint)

        // Draw HUD badge above or inside the node
        val badgeW = maxOf(node.screenWidth * 0.95f, 220f)
        val badgeH = 75f
        val badgeX = node.screenX + 8f
        val badgeY = maxOf(node.screenY - badgeH - 6f, 100f)

        val badgeRect = RectF(badgeX, badgeY, badgeX + badgeW, badgeY + badgeH)
        badgeBgPaint.color = badgeBg
        canvas.drawRoundRect(badgeRect, 10f, 10f, badgeBgPaint)

        // Draw title
        val title = "${node.nodeId.uppercase()} [${node.type.uppercase()}]"
        canvas.drawText(title, badgeX + 12f, badgeY + 30f, textHeaderPaint)

        // Draw status & latency
        val statusText = if (isHealthy) {
            val latText = node.latencyMs?.let { " | ${String.format("%.1f", it)}ms" } ?: ""
            "● HEALTHY$latText"
        } else if (isDown) {
            "▲ DOWN (UNREACHABLE)"
        } else {
            "? UNKNOWN"
        }

        textStatusPaint.color = borderColor
        canvas.drawText(statusText, badgeX + 12f, badgeY + 60f, textStatusPaint)
    }
}
