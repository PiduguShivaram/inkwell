package com.inkwell.mobile

import com.google.gson.Gson
import com.inkwell.mobile.models.*
import org.junit.Assert.*
import org.junit.Test

class MobileWorkflowTest {

    private val gson = Gson()

    @Test
    fun testGraphIRSerializationCompatibility() {
        val node1 = GraphNode(
            id = "api-gateway",
            type = "service",
            label = "API Gateway",
            position = NodePosition(60, 160),
            ports = NodePorts(3000, 3000),
            env = mapOf("SERVICE_NAME" to "API Gateway", "PORT" to "3000")
        )

        val node2 = GraphNode(
            id = "task-queue",
            type = "queue",
            label = "Task Queue",
            position = NodePosition(350, 160),
            ports = NodePorts(6379, 6379),
            env = mapOf("QUEUE_NAME" to "task-queue")
        )

        val edge = GraphEdge(
            id = "edge-api-gateway->task-queue",
            source = "api-gateway",
            target = "task-queue",
            label = "publishes jobs"
        )

        val graph = GraphIR(
            version = "1.0",
            metadata = GraphMetadata("Canonical Pipeline", "1.0.0", "2026-10-05T00:00:00Z", "2026-10-05T00:00:00Z"),
            nodes = mutableListOf(node1, node2),
            edges = mutableListOf(edge)
        )

        val json = gson.toJson(graph)
        assertTrue(json.contains("api-gateway"))
        assertTrue(json.contains("task-queue"))
        assertTrue(json.contains("publishes jobs"))

        val deserialized = gson.fromJson(json, GraphIR::class.java)
        assertEquals(2, deserialized.nodes.size)
        assertEquals("api-gateway", deserialized.nodes[0].id)
        assertEquals("task-queue", deserialized.nodes[1].id)
        assertEquals(1, deserialized.edges.size)
    }

    @Test
    fun testExtractionResultParsing() {
        val jsonPayload = """
            {
                "success": true,
                "confidence": 0.98,
                "providerUsed": "inkwell-native-cv-winocr-pipeline",
                "graph": {
                    "version": "1.0",
                    "metadata": {
                        "name": "Physical Sketch Pipeline",
                        "version": "1.0.0",
                        "createdAt": "2026-10-05T00:00:00Z",
                        "updatedAt": "2026-10-05T00:00:00Z"
                    },
                    "nodes": [
                        { "id": "api-gateway", "type": "service", "label": "API Gateway" },
                        { "id": "task-queue", "type": "queue", "label": "Task Queue" },
                        { "id": "processing-worker", "type": "worker", "label": "Background Worker" },
                        { "id": "primary-db", "type": "database", "label": "Primary Database" }
                    ],
                    "edges": [
                        { "id": "e1", "source": "api-gateway", "target": "task-queue", "label": "publishes jobs" }
                    ]
                }
            }
        """.trimIndent()

        val result = gson.fromJson(jsonPayload, GraphExtractionResult::class.java)
        assertTrue(result.success)
        assertEquals(0.98, result.confidence ?: 0.0, 0.001)
        assertNotNull(result.graph)
        assertEquals(4, result.graph?.nodes?.size)
        assertEquals(1, result.graph?.edges?.size)
    }

    @Test
    fun testUserVerificationNodeEditing() {
        val node = GraphNode(
            id = "node-1",
            type = "service",
            label = "Unknown Svc"
        )

        // User reclassifies node during verification
        node.type = "worker"
        node.label = "Processing Worker"

        assertEquals("worker", node.type)
        assertEquals("Processing Worker", node.label)
    }
}
