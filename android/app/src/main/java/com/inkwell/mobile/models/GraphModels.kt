package com.inkwell.mobile.models

import com.google.gson.annotations.SerializedName

data class NodePosition(
    val x: Int = 0,
    val y: Int = 0
)

data class NodeBoundingBox(
    val x: Int = 0,
    val y: Int = 0,
    val width: Int = 120,
    val height: Int = 60
)

data class NodePorts(
    val internalPort: Int = 3000,
    val hostPort: Int = 3000
)

data class GraphNode(
    val id: String,
    var type: String,
    var label: String,
    val position: NodePosition = NodePosition(),
    val width: Int = 120,
    val height: Int = 60,
    val ports: NodePorts = NodePorts(),
    val env: Map<String, String> = emptyMap()
)

data class GraphEdge(
    val id: String,
    val source: String,
    val target: String,
    val label: String
)

data class GraphMetadata(
    val name: String,
    val version: String,
    val createdAt: String,
    val updatedAt: String
)

data class GraphIR(
    val version: String = "1.0",
    val metadata: GraphMetadata = GraphMetadata("Physical Sketch Graph", "1.0.0", "", ""),
    val nodes: MutableList<GraphNode> = mutableListOf(),
    val edges: MutableList<GraphEdge> = mutableListOf()
)

data class IngestionStage(
    val stage: String,
    val name: String,
    val status: String,
    val message: String,
    val timestamp: String
)

data class DetectedNodeInfo(
    val id: String,
    val type: String,
    val label: String,
    val position: NodePosition = NodePosition(),
    val width: Int = 120,
    val height: Int = 60,
    val confidence: Double = 0.8,
    val extractedText: String = ""
)

data class DetectedElements(
    val nodeCount: Int = 0,
    val edgeCount: Int = 0,
    val boxesDetected: Int = 0,
    val ocrWordsDetected: Int = 0,
    val nodes: List<DetectedNodeInfo> = emptyList()
)

data class DrawingReferenceFrame(
    val width: Int = 1600,
    val height: Int = 1200,
    val corners: List<NodePosition> = emptyList(),
    val bounds: NodeBoundingBox = NodeBoundingBox(),
    val nodeRegions: Map<String, NodeBoundingBox> = emptyMap()
)

data class GraphExtractionResult(
    val success: Boolean,
    val graph: GraphIR? = null,
    val confidence: Double? = null,
    val error: String? = null,
    val stages: List<IngestionStage> = emptyList(),
    val detectedElements: DetectedElements? = null,
    val referenceFrame: DrawingReferenceFrame? = null,
    val providerUsed: String = ""
)

data class CompileResponse(
    val success: Boolean,
    val diskPath: String? = null,
    val error: String? = null
)

data class ServiceTelemetry(
    val nodeId: String,
    val serviceName: String,
    val serviceType: String,
    val hostPort: Int = 0,
    val healthEndpoint: String? = null,
    val healthStatus: String = "unknown",
    val httpStatus: Int? = null,
    val latencyMs: Double? = null,
    val containerState: String = "unknown",
    val containerStatusText: String = "",
    val error: String? = null
)

data class TelemetryResponse(
    val timestamp: String = "",
    val dockerAvailable: Boolean = false,
    val services: List<ServiceTelemetry> = emptyList()
)

enum class AlignmentStatus {
    ALIGNED,
    REFERENCE_LOST,
    LOW_CONFIDENCE,
    UNINITIALIZED
}

data class LiveNodeOverlayState(
    val nodeId: String,
    val type: String,
    val label: String,
    val screenX: Float,
    val screenY: Float,
    val screenWidth: Float,
    val screenHeight: Float,
    val status: String = "UNKNOWN", // HEALTHY, DOWN, UNKNOWN
    val latencyMs: Double? = null,
    val details: String = ""
)
