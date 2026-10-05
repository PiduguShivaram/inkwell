package com.inkwell.mobile

import com.inkwell.mobile.models.*
import com.inkwell.mobile.spatial.SpatialAlignmentEngine
import org.junit.Assert.*
import org.junit.Test

class SpatialAlignmentEngineTest {

    private val testNodes = listOf(
        GraphNode("api-gateway", "service", "API Gateway", NodePosition(100, 200), 150, 80),
        GraphNode("task-queue", "queue", "Task Queue", NodePosition(300, 200), 150, 80),
        GraphNode("processing-worker", "worker", "Processing Worker", NodePosition(500, 200), 150, 80),
        GraphNode("primary-db", "database", "Primary DB", NodePosition(700, 200), 150, 80)
    )

    private val testReferenceFrame = DrawingReferenceFrame(
        width = 1000,
        height = 600,
        corners = listOf(
            NodePosition(50, 50),
            NodePosition(950, 50),
            NodePosition(950, 550),
            NodePosition(50, 550)
        ),
        bounds = NodeBoundingBox(50, 50, 900, 500),
        nodeRegions = mapOf(
            "api-gateway" to NodeBoundingBox(100, 200, 150, 80),
            "task-queue" to NodeBoundingBox(300, 200, 150, 80),
            "processing-worker" to NodeBoundingBox(500, 200, 150, 80),
            "primary-db" to NodeBoundingBox(700, 200, 150, 80)
        )
    )

    @Test
    fun testReferenceRegistrationAndUninitializedState() {
        val engine = SpatialAlignmentEngine()
        assertFalse(engine.hasReference())
        assertEquals(AlignmentStatus.UNINITIALIZED, engine.getStatus())

        // Initial alignment without reference returns empty list
        val unaligned = engine.computeAlignment(1080f, 2400f)
        assertTrue(unaligned.isEmpty())

        // Register reference
        engine.setReference(testReferenceFrame, testNodes)
        assertTrue(engine.hasReference())
        assertEquals(AlignmentStatus.ALIGNED, engine.getStatus())
    }

    @Test
    fun testPlanarHomographyProjection() {
        val src = floatArrayOf(
            0f, 0f,
            100f, 0f,
            100f, 100f,
            0f, 100f
        )
        val dst = floatArrayOf(
            200f, 300f,
            300f, 300f,
            300f, 400f,
            200f, 400f
        )

        val H = SpatialAlignmentEngine.computePlanarHomography(src, dst)
        val (px, py) = SpatialAlignmentEngine.projectPoint(H, 50f, 50f)
        assertEquals(250f, px, 1.0f)
        assertEquals(350f, py, 1.0f)
    }

    @Test
    fun testSpatialAlignmentProjectsAllNodes() {
        val engine = SpatialAlignmentEngine()
        engine.setReference(testReferenceFrame, testNodes)

        val aligned = engine.computeAlignment(1080f, 2400f)
        assertEquals(4, aligned.size)

        val apiOverlay = aligned.find { it.nodeId == "api-gateway" }
        assertNotNull(apiOverlay)
        assertTrue(apiOverlay!!.screenX > 0f)
        assertTrue(apiOverlay.screenY > 0f)
        assertTrue(apiOverlay.screenWidth > 0f)
        assertTrue(apiOverlay.screenHeight > 0f)

        // Without telemetry, status is UNKNOWN
        assertEquals("UNKNOWN", apiOverlay.status)
    }

    @Test
    fun testTelemetryHealthyMapping() {
        val engine = SpatialAlignmentEngine()
        engine.setReference(testReferenceFrame, testNodes)

        val healthyTelemetry = TelemetryResponse(
            timestamp = "2026-10-05T14:35:00Z",
            dockerAvailable = true,
            services = listOf(
                ServiceTelemetry("api-gateway", "api-gateway", "service", 3000, "/health", "healthy", 200, 5.42, "running", "Up 1 hour", null),
                ServiceTelemetry("task-queue", "task-queue", "queue", 6379, null, "healthy", null, null, "running", "Up 1 hour", null),
                ServiceTelemetry("processing-worker", "processing-worker", "worker", 3001, "/health", "healthy", 200, 8.49, "running", "Up 1 hour", null),
                ServiceTelemetry("primary-db", "primary-db", "database", 5432, null, "healthy", null, null, "running", "Up 1 hour", null)
            )
        )

        engine.updateTelemetry(healthyTelemetry)
        val aligned = engine.computeAlignment(1080f, 2400f)

        val apiNode = aligned.find { it.nodeId == "api-gateway" }!!
        assertEquals("HEALTHY", apiNode.status)
        assertEquals(5.42, apiNode.latencyMs ?: 0.0, 0.01)

        val workerNode = aligned.find { it.nodeId == "processing-worker" }!!
        assertEquals("HEALTHY", workerNode.status)
        assertEquals(8.49, workerNode.latencyMs ?: 0.0, 0.01)
    }

    @Test
    fun testWorkerFailureDetectionAndRecovery() {
        val engine = SpatialAlignmentEngine()
        engine.setReference(testReferenceFrame, testNodes)

        // 1. Worker failure state (e.g. docker stop processing-worker)
        val failureTelemetry = TelemetryResponse(
            timestamp = "2026-10-05T14:36:00Z",
            dockerAvailable = true,
            services = listOf(
                ServiceTelemetry("api-gateway", "api-gateway", "service", 3000, "/health", "healthy", 200, 5.42, "running", "Up 1 hour", null),
                ServiceTelemetry("processing-worker", "processing-worker", "worker", 3001, "/health", "unreachable", null, null, "offline", "Connection refused", "fetch failed")
            )
        )

        engine.updateTelemetry(failureTelemetry)
        val failureAligned = engine.computeAlignment(1080f, 2400f)

        val workerDown = failureAligned.find { it.nodeId == "processing-worker" }!!
        assertEquals("DOWN", workerDown.status)
        assertNull(workerDown.latencyMs)
        assertTrue(workerDown.details.contains("fetch failed") || workerDown.details.contains("Offline"))

        // 2. Worker recovery state (e.g. docker start processing-worker)
        val recoveryTelemetry = TelemetryResponse(
            timestamp = "2026-10-05T14:37:00Z",
            dockerAvailable = true,
            services = listOf(
                ServiceTelemetry("api-gateway", "api-gateway", "service", 3000, "/health", "healthy", 200, 5.10, "running", "Up 1 hour", null),
                ServiceTelemetry("processing-worker", "processing-worker", "worker", 3001, "/health", "healthy", 200, 7.85, "running", "Up 5 seconds", null)
            )
        )

        engine.updateTelemetry(recoveryTelemetry)
        val recoveryAligned = engine.computeAlignment(1080f, 2400f)

        val workerRecovered = recoveryAligned.find { it.nodeId == "processing-worker" }!!
        assertEquals("HEALTHY", workerRecovered.status)
        assertEquals(7.85, workerRecovered.latencyMs ?: 0.0, 0.01)
    }
}
