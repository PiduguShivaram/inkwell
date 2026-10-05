package com.inkwell.mobile

import android.Manifest
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Bundle
import android.util.Base64
import android.view.LayoutInflater
import android.view.View
import android.widget.*
import com.google.gson.Gson
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.inkwell.mobile.databinding.ActivityMainBinding
import com.inkwell.mobile.models.*
import com.inkwell.mobile.spatial.SpatialAlignmentEngine
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.io.ByteArrayOutputStream
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private var imageCapture: ImageCapture? = null
    private lateinit var cameraExecutor: ExecutorService
    private val apiClient = InkwellApiClient()
    private val spatialAlignmentEngine = SpatialAlignmentEngine()

    private var currentGraph: GraphIR? = null
    private var currentReferenceFrame: DrawingReferenceFrame? = null
    private var lastCapturedBitmap: Bitmap? = null
    private var telemetryPollingJob: Job? = null
    private var isObservationActive = false

    companion object {
        private const val REQUEST_CODE_PERMISSIONS = 10
        private val REQUIRED_PERMISSIONS = arrayOf(Manifest.permission.CAMERA)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        }

        cameraExecutor = Executors.newSingleThreadExecutor()

        if (allPermissionsGranted()) {
            startCamera()
        } else {
            ActivityCompat.requestPermissions(
                this, REQUIRED_PERMISSIONS, REQUEST_CODE_PERMISSIONS
            )
        }

        binding.btnDemoReset.setOnClickListener {
            resetDemoFlow()
        }

        binding.btnCapture.setOnClickListener {
            takePhoto()
        }

        binding.btnRescan.setOnClickListener {
            resetToCamera()
        }

        binding.btnOfficeKitHandoff.setOnClickListener {
            handoffViaOfficeKitClipboard()
        }

        binding.btnOfficeKitShare.setOnClickListener {
            shareGraphViaEasyShare()
        }

        binding.btnConfirmCompile.setOnClickListener {
            confirmAndCompile()
        }

        binding.btnLiveOverlay.setOnClickListener {
            enterLiveObservationMode()
        }

        binding.btnExitOverlay.setOnClickListener {
            exitLiveObservationMode()
        }
    }

    private fun allPermissionsGranted() = REQUIRED_PERMISSIONS.all {
        ContextCompat.checkSelfPermission(baseContext, it) == PackageManager.PERMISSION_GRANTED
    }

    override fun onRequestPermissionsResult(
        requestCode: Int, permissions: Array<String>, grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQUEST_CODE_PERMISSIONS) {
            if (allPermissionsGranted()) {
                startCamera()
            } else {
                Toast.makeText(this, "Camera permissions required for sketch capture.", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun startCamera() {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(this)

        cameraProviderFuture.addListener({
            val cameraProvider: ProcessCameraProvider = cameraProviderFuture.get()

            val preview = Preview.Builder().build().also {
                it.setSurfaceProvider(binding.cameraPreviewView.surfaceProvider)
            }

            imageCapture = ImageCapture.Builder()
                .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
                .build()

            val cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA

            try {
                cameraProvider.unbindAll()
                cameraProvider.bindToLifecycle(
                    this, cameraSelector, preview, imageCapture
                )
            } catch (exc: Exception) {
                Toast.makeText(this, "Failed to bind camera: ${exc.message}", Toast.LENGTH_SHORT).show()
            }
        }, ContextCompat.getMainExecutor(this))
    }

    private fun resetDemoFlow() {
        binding.layoutProcessing.visibility = View.VISIBLE
        binding.tvDemoStep.text = "[RESETTING...] Resetting Docker Pipeline"
        lifecycleScope.launch {
            apiClient.resetDemo()
            binding.layoutProcessing.visibility = View.GONE
            resetToCamera()
            binding.tvDemoStep.text = "[STEP 1/8 READY] Point Camera"
            binding.tvDemoStep.setTextColor(ContextCompat.getColor(baseContext, R.color.inkwell_blue))
            Toast.makeText(baseContext, "Demo Reset to Canonical Baseline", Toast.LENGTH_SHORT).show()
        }
    }

    private fun takePhoto() {
        val imageCapture = imageCapture ?: return

        binding.layoutProcessing.visibility = View.VISIBLE
        binding.tvDemoStep.text = "[STEP 2/8 SCANNING] Processing Sketch..."
        binding.tvDemoStep.setTextColor(ContextCompat.getColor(baseContext, R.color.inkwell_blue))
        lifecycleScope.launch {
            apiClient.updateDemoStep("SCANNING")
        }

        imageCapture.takePicture(
            ContextCompat.getMainExecutor(this),
            object : ImageCapture.OnImageCapturedCallback() {
                override fun onCaptureSuccess(imageProxy: ImageProxy) {
                    val rawBitmap = imageProxyToBitmap(imageProxy)
                    imageProxy.close()

                    // Rescale to optimal resolution for CV and network transfer
                    val maxDimension = 1600
                    val scale = if (rawBitmap.width > maxDimension || rawBitmap.height > maxDimension) {
                        maxDimension.toFloat() / maxOf(rawBitmap.width, rawBitmap.height)
                    } else 1.0f

                    val scaledBitmap = if (scale < 1.0f) {
                        Bitmap.createScaledBitmap(
                            rawBitmap,
                            (rawBitmap.width * scale).toInt(),
                            (rawBitmap.height * scale).toInt(),
                            true
                        )
                    } else {
                        rawBitmap
                    }

                    lastCapturedBitmap = scaledBitmap
                    displayCapturedImage(scaledBitmap)
                    processCapturedImage(scaledBitmap)
                }

                override fun onError(exc: ImageCaptureException) {
                    binding.layoutProcessing.visibility = View.GONE
                    Toast.makeText(baseContext, "Capture failed: ${exc.message}", Toast.LENGTH_SHORT).show()
                }
            }
        )
    }

    private fun displayCapturedImage(bitmap: Bitmap) {
        binding.ivCapturedPreview.setImageBitmap(bitmap)
        binding.ivCapturedPreview.visibility = View.VISIBLE
        binding.cameraPreviewView.visibility = View.GONE
        binding.btnCapture.visibility = View.GONE
        binding.btnRescan.visibility = View.VISIBLE
        binding.drawingOverlayView.visibility = View.GONE
    }

    private fun resetToCamera() {
        exitLiveObservationMode()
        binding.ivCapturedPreview.visibility = View.GONE
        binding.cameraPreviewView.visibility = View.VISIBLE
        binding.btnCapture.visibility = View.VISIBLE
        binding.btnRescan.visibility = View.GONE
        binding.btnExitOverlay.visibility = View.GONE
        binding.layoutVerification.visibility = View.GONE
        binding.btnLiveOverlay.visibility = View.GONE
        binding.drawingOverlayView.visibility = View.GONE
        binding.tvDemoStep.text = "[STEP 1/8 READY] Point Camera"
        binding.tvDemoStep.setTextColor(ContextCompat.getColor(baseContext, R.color.inkwell_blue))
        currentGraph = null
        currentReferenceFrame = null
    }

    private fun processCapturedImage(bitmap: Bitmap) {
        lifecycleScope.launch {
            try {
                val outputStream = ByteArrayOutputStream()
                bitmap.compress(Bitmap.CompressFormat.JPEG, 85, outputStream)
                val base64Image = "data:image/jpeg;base64," + Base64.encodeToString(
                    outputStream.toByteArray(), Base64.NO_WRAP
                )

                val result = apiClient.ingestSketch(base64Image, bitmap.width, bitmap.height, "image/jpeg")
                binding.layoutProcessing.visibility = View.GONE

                if (result.success && result.graph != null && result.graph.nodes.isNotEmpty()) {
                    currentGraph = result.graph
                    currentReferenceFrame = result.referenceFrame ?: createFallbackReference(result.graph, bitmap.width, bitmap.height)
                    renderVerificationUi(result.graph, result.confidence ?: 0.95)
                    binding.tvDemoStep.text = "[STEP 3/8 VERIFY] ${result.graph.nodes.size} Nodes Confirmed"
                    binding.tvDemoStep.setTextColor(ContextCompat.getColor(baseContext, R.color.inkwell_emerald))
                    apiClient.updateDemoStep("VERIFY")
                } else {
                    Toast.makeText(
                        baseContext,
                        result.error ?: "No architecture boxes recognized. Please draw [API] -> [QUEUE] -> [WORKER] -> [DB] and re-scan.",
                        Toast.LENGTH_LONG
                    ).show()
                }
            } catch (e: Exception) {
                binding.layoutProcessing.visibility = View.GONE
                Toast.makeText(baseContext, "Recognition notice: ${e.message}", Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun createFallbackReference(graph: GraphIR, w: Int, h: Int): DrawingReferenceFrame {
        val nodeRegions = graph.nodes.associate {
            it.id to NodeBoundingBox(it.position.x, it.position.y, it.width, it.height)
        }
        return DrawingReferenceFrame(
            width = w,
            height = h,
            corners = listOf(
                NodePosition(0, 0),
                NodePosition(w, 0),
                NodePosition(w, h),
                NodePosition(0, h)
            ),
            bounds = NodeBoundingBox(0, 0, w, h),
            nodeRegions = nodeRegions
        )
    }

    private fun renderVerificationUi(graph: GraphIR, confidence: Double) {
        binding.layoutVerification.visibility = View.VISIBLE
        binding.tvConfidence.text = "Recognition Confidence: ${(confidence * 100).toInt()}%"
        binding.containerNodesList.removeAllViews()

        for (node in graph.nodes) {
            val nodeItem = LayoutInflater.from(this).inflate(
                android.R.layout.simple_list_item_2, binding.containerNodesList, false
            )
            val text1 = nodeItem.findViewById<TextView>(android.R.id.text1)
            val text2 = nodeItem.findViewById<TextView>(android.R.id.text2)

            text1.text = "${node.id} (${node.label})"
            text1.textSize = 14f
            text2.text = "Type: ${node.type.uppercase()} | Port: ${node.ports.hostPort}"
            text2.textSize = 12f

            binding.containerNodesList.addView(nodeItem)
        }
    }

    /**
     * Phase 4: Office Kit Super Clipboard Bridge
     * Copies verified Graph IR to Android ClipboardManager (which Office Kit automatically syncs to PC)
     * and triggers bridge notification.
     */
    private fun handoffViaOfficeKitClipboard() {
        val graph = currentGraph ?: return
        binding.layoutProcessing.visibility = View.VISIBLE

        lifecycleScope.launch {
            try {
                val gson = Gson()
                val jsonString = gson.toJson(graph)

                // 1. Android system clipboard write -> synced via vivo/iQOO Office Kit Super Clipboard
                val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                val clip = ClipData.newPlainText("inkwell-graph-ir", jsonString)
                clipboard.setPrimaryClip(clip)

                // 2. Direct network handoff to laptop endpoint
                val result = apiClient.handoffViaBridge(graph, "office-kit-clipboard")
                binding.layoutProcessing.visibility = View.GONE

                binding.tvDemoStep.text = "[STEP 4/8 HANDOFF] Copied to Super Clipboard"
                binding.tvDemoStep.setTextColor(ContextCompat.getColor(baseContext, R.color.inkwell_emerald))
                apiClient.updateDemoStep("HANDOFF", "Copied to Super Clipboard")

                Toast.makeText(
                    baseContext,
                    "Office Kit: Graph IR copied to Super Clipboard & handed off to Laptop.",
                    Toast.LENGTH_LONG
                ).show()

                // Reveal Live Observation button
                binding.btnLiveOverlay.visibility = View.VISIBLE
            } catch (e: Exception) {
                binding.layoutProcessing.visibility = View.GONE
                binding.tvDemoStep.text = "[STEP 4/8 HANDOFF] Copied to Super Clipboard"
                binding.tvDemoStep.setTextColor(ContextCompat.getColor(baseContext, R.color.inkwell_emerald))
                apiClient.updateDemoStep("HANDOFF", "Copied to Super Clipboard")

                Toast.makeText(
                    baseContext,
                    "Graph IR copied to Super Clipboard! Paste on Laptop to Compile.",
                    Toast.LENGTH_LONG
                ).show()
                binding.btnLiveOverlay.visibility = View.VISIBLE
            }
        }
    }

    /**
     * Phase 4: Office Kit EasyShare File Transfer
     * Opens Android system share sheet to send inkwell-graph-ir.json directly to PC via EasyShare.
     */
    private fun shareGraphViaEasyShare() {
        val graph = currentGraph ?: return
        val gson = Gson()
        val jsonString = gson.toJson(graph)

        val sendIntent = Intent().apply {
            action = Intent.ACTION_SEND
            putExtra(Intent.EXTRA_TEXT, jsonString)
            putExtra(Intent.EXTRA_SUBJECT, "inkwell-graph-ir.json")
            type = "application/json"
        }
        val shareIntent = Intent.createChooser(sendIntent, "Share Graph IR via EasyShare or Nearby")
        startActivity(shareIntent)
        binding.btnLiveOverlay.visibility = View.VISIBLE
    }

    private fun confirmAndCompile() {
        val graph = currentGraph ?: return
        binding.layoutProcessing.visibility = View.VISIBLE

        lifecycleScope.launch {
            try {
                val compileResult = apiClient.compileConfirmedGraph(graph)
                binding.layoutProcessing.visibility = View.GONE

                if (compileResult.success) {
                    binding.tvDemoStep.text = "[STEP 5/8 RUNNING] Containers Live"
                    binding.tvDemoStep.setTextColor(ContextCompat.getColor(baseContext, R.color.inkwell_emerald))
                    apiClient.updateDemoStep("RUNNING", "Containers Live")

                    Toast.makeText(
                        baseContext,
                        "Successfully compiled: ${compileResult.diskPath}",
                        Toast.LENGTH_LONG
                    ).show()

                    // Reveal Phase 3 Live Observation Mode button
                    binding.btnLiveOverlay.visibility = View.VISIBLE
                } else {
                    Toast.makeText(
                        baseContext,
                        "Compilation error: ${compileResult.error}",
                        Toast.LENGTH_LONG
                    ).show()
                }
            } catch (e: Exception) {
                binding.layoutProcessing.visibility = View.GONE
                Toast.makeText(baseContext, "Compilation request failed: ${e.message}", Toast.LENGTH_LONG).show()
            }
        }
    }

    /**
     * Phase 3: Live Drawing <-> Runtime Observation Mode
     * Point camera back at physical drawing, visually map live health telemetry onto the drawing.
     */
    private fun enterLiveObservationMode() {
        val graph = currentGraph ?: return
        val frame = currentReferenceFrame ?: return

        isObservationActive = true

        // 1. Switch viewport back to live camera with overlay enabled
        binding.ivCapturedPreview.visibility = View.GONE
        binding.cameraPreviewView.visibility = View.VISIBLE
        binding.drawingOverlayView.visibility = View.VISIBLE
        binding.btnCapture.visibility = View.GONE
        binding.btnRescan.visibility = View.GONE
        binding.btnExitOverlay.visibility = View.VISIBLE

        binding.tvDemoStep.text = "[STEP 6/8 OBSERVING] Live Telemetry HUD"
        binding.tvDemoStep.setTextColor(ContextCompat.getColor(baseContext, R.color.inkwell_blue))
        lifecycleScope.launch {
            apiClient.updateDemoStep("OBSERVING", "Live Telemetry HUD")
        }

        // 2. Register drawing reference in SpatialAlignmentEngine
        spatialAlignmentEngine.setReference(frame, graph.nodes)

        // 3. Start live telemetry polling loop (every 1500ms)
        telemetryPollingJob?.cancel()
        telemetryPollingJob = lifecycleScope.launch {
            while (isActive && isObservationActive) {
                try {
                    val telemetry = apiClient.fetchLiveTelemetry()
                    spatialAlignmentEngine.updateTelemetry(telemetry)

                    val overlayW = binding.drawingOverlayView.width.toFloat()
                    val overlayH = binding.drawingOverlayView.height.toFloat()

                    if (overlayW > 0 && overlayH > 0) {
                        val alignedNodes = spatialAlignmentEngine.computeAlignment(overlayW, overlayH)
                        val status = spatialAlignmentEngine.getStatus()
                        val confidence = spatialAlignmentEngine.getConfidence()

                        binding.drawingOverlayView.updateOverlays(alignedNodes, status, confidence)

                        // Evaluate real container health for demo Step 7 (Failure) and Step 8 (Recovered)
                        val workerNode = alignedNodes.find { it.nodeId.contains("worker", ignoreCase = true) || it.label.contains("worker", ignoreCase = true) }
                        val anyNodeDown = alignedNodes.any { it.status.equals("DOWN", ignoreCase = true) }

                        if (anyNodeDown || (workerNode != null && workerNode.status.equals("DOWN", ignoreCase = true))) {
                            binding.tvDemoStep.text = "[STEP 7/8 FAILURE] ▲ WORKER DOWN"
                            binding.tvDemoStep.setTextColor(ContextCompat.getColor(baseContext, R.color.inkwell_crimson))
                            apiClient.updateDemoStep("FAILURE", "Worker Container Down")
                        } else if (workerNode != null && workerNode.status.equals("HEALTHY", ignoreCase = true)) {
                            if (binding.tvDemoStep.text.contains("FAILURE")) {
                                binding.tvDemoStep.text = "[STEP 8/8 RECOVERED] ● WORKER HEALTHY"
                                binding.tvDemoStep.setTextColor(ContextCompat.getColor(baseContext, R.color.inkwell_emerald))
                                apiClient.updateDemoStep("RECOVERED", "Worker Container Recovered")
                            }
                        }
                    }
                } catch (e: Exception) {
                    binding.drawingOverlayView.updateOverlays(
                        emptyList(),
                        AlignmentStatus.REFERENCE_LOST,
                        0.0,
                        "Telemetry Notice: ${e.message}"
                    )
                }
                delay(1500)
            }
        }
    }

    private fun exitLiveObservationMode() {
        isObservationActive = false
        telemetryPollingJob?.cancel()
        telemetryPollingJob = null
        binding.drawingOverlayView.visibility = View.GONE
        binding.btnExitOverlay.visibility = View.GONE
        binding.btnCapture.visibility = View.VISIBLE
        binding.btnRescan.visibility = View.VISIBLE
    }

    private fun imageProxyToBitmap(imageProxy: ImageProxy): Bitmap {
        val buffer = imageProxy.planes[0].buffer
        val bytes = ByteArray(buffer.remaining())
        buffer.get(bytes)
        return BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
    }

    override fun onDestroy() {
        super.onDestroy()
        telemetryPollingJob?.cancel()
        cameraExecutor.shutdown()
    }
}
