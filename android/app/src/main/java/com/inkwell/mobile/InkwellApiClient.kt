package com.inkwell.mobile

import com.google.gson.Gson
import com.inkwell.mobile.models.CompileResponse
import com.inkwell.mobile.models.GraphExtractionResult
import com.inkwell.mobile.models.GraphIR
import com.inkwell.mobile.models.TelemetryResponse
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit
import org.json.JSONObject

class InkwellApiClient(
    private var primaryUrl: String = "http://127.0.0.1:3005"
) {
    private val candidateUrls = listOf(
        "http://127.0.0.1:3005",
        "http://localhost:3005",
        "http://192.168.0.6:3005",
        "http://10.0.2.2:3005"
    )

    private val client = OkHttpClient.Builder()
        .connectTimeout(5, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .build()

    private val gson = Gson()
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    suspend fun ingestSketch(
        base64Image: String,
        width: Int,
        height: Int,
        format: String = "image/png"
    ): GraphExtractionResult = withContext(Dispatchers.IO) {
        val payload = JSONObject().apply {
            put("image", base64Image)
            put("metadata", JSONObject().apply {
                put("width", width)
                put("height", height)
                put("format", format)
                put("sizeBytes", base64Image.length)
                put("aspectRatio", width.toDouble() / height.toDouble())
            })
        }

        var lastException: Exception? = null
        val urlsToTry = listOf(primaryUrl) + candidateUrls.filter { it != primaryUrl }

        for (url in urlsToTry) {
            try {
                val request = Request.Builder()
                    .url("$url/api/vision/ingest")
                    .post(payload.toString().toRequestBody(jsonMediaType))
                    .build()

                client.newCall(request).execute().use { response ->
                    val bodyString = response.body?.string() ?: ""
                    if (response.isSuccessful || bodyString.contains("graph")) {
                        primaryUrl = url
                        return@withContext gson.fromJson(bodyString, GraphExtractionResult::class.java)
                    }
                }
            } catch (e: Exception) {
                lastException = e
            }
        }

        throw lastException ?: Exception("Failed to connect to Inkwell backend endpoints")
    }

    suspend fun compileConfirmedGraph(graph: GraphIR): CompileResponse = withContext(Dispatchers.IO) {
        val jsonPayload = gson.toJson(graph)
        val urlsToTry = listOf(primaryUrl) + candidateUrls.filter { it != primaryUrl }
        var lastException: Exception? = null

        for (url in urlsToTry) {
            try {
                val request = Request.Builder()
                    .url("$url/api/compile")
                    .post(jsonPayload.toRequestBody(jsonMediaType))
                    .build()

                client.newCall(request).execute().use { response ->
                    val bodyString = response.body?.string() ?: ""
                    if (response.isSuccessful) {
                        return@withContext gson.fromJson(bodyString, CompileResponse::class.java)
                    }
                }
            } catch (e: Exception) {
                lastException = e
            }
        }

        throw lastException ?: Exception("Failed to compile confirmed graph")
    }

    suspend fun fetchLiveTelemetry(projectName: String? = null): TelemetryResponse = withContext(Dispatchers.IO) {
        val targetPath = if (projectName != null) "/api/telemetry?projectName=$projectName" else "/api/telemetry"
        val urlsToTry = listOf(primaryUrl) + candidateUrls.filter { it != primaryUrl }
        var lastException: Exception? = null

        for (url in urlsToTry) {
            try {
                val request = Request.Builder()
                    .url("$url$targetPath")
                    .get()
                    .build()

                client.newCall(request).execute().use { response ->
                    val bodyString = response.body?.string() ?: ""
                    if (response.isSuccessful) {
                        return@withContext gson.fromJson(bodyString, TelemetryResponse::class.java)
                    }
                }
            } catch (e: Exception) {
                lastException = e
            }
        }

        throw lastException ?: Exception("Failed to fetch live telemetry")
    }
}
