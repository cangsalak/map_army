package com.geomonitor.dronebridge.network

import android.util.Log
import okhttp3.*
import java.util.concurrent.TimeUnit

class GeoMonitorWebSocketBridge(
    private val serverUrl: String,
    private val authToken: String
) {
    companion object {
        private const val TAG = "GeoMonitorWSBridge"
    }

    private val client = OkHttpClient.Builder()
        .readTimeout(10, TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .build()

    private var webSocket: WebSocket? = null
    private var isConnected = false

    fun connect(onMessageReceived: (String) -> Unit) {
        val request = Request.Builder()
            .url(serverUrl)
            .addHeader("Authorization", "Bearer $authToken")
            .addHeader("X-Device-Type", "DJI_MINI_4_PRO_BRIDGE")
            .build()

        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(ws: WebSocket, response: Response) {
                isConnected = true
                Log.i(TAG, "Connected to GeoMonitor 3D Telemetry Server")
            }

            override fun onMessage(ws: WebSocket, text: String) {
                onMessageReceived(text)
            }

            override fun onFailure(ws: WebSocket, t: Throwable, response: Response?) {
                isConnected = false
                Log.e(TAG, "WebSocket Bridge Error: ${t.message}")
            }

            override fun onClosed(ws: WebSocket, code: Int, reason: String) {
                isConnected = false
                Log.w(TAG, "WebSocket Closed: $reason")
            }
        })
    }

    fun sendTelemetry(jsonTelemetry: String) {
        if (isConnected) {
            webSocket?.send(jsonTelemetry)
        }
    }

    fun sendStateUpdate(jsonState: String) {
        if (isConnected) {
            webSocket?.send(jsonState)
        }
    }

    fun disconnect() {
        webSocket?.close(1000, "Normal Shutdown")
        isConnected = false
    }
}
