package com.geomonitor.dronebridge.service

import android.app.Service
import android.content.Intent
import android.os.IBinder
import android.util.Log
import dji.v5.common.callback.CommonCallbacks
import dji.v5.common.error.IDJIError
import dji.v5.manager.aircraft.waypoint3.WaypointMissionExecuteState
import dji.v5.manager.aircraft.waypoint3.WaypointMissionExecuteStateListener
import dji.v5.manager.aircraft.waypoint3.WaypointMissionManager
import dji.v5.manager.key.KeyManager
import dji.v5.keyvalue.key.FlightControllerKey
import dji.v5.keyvalue.key.BatteryKey
import dji.v5.keyvalue.key.KeyTools
import com.geomonitor.dronebridge.network.GeoMonitorWebSocketBridge
import org.json.JSONObject

class DJIMissionExecutionService : Service() {

    companion object {
        private const val TAG = "DJIMissionExecService"
    }

    private val missionManager by lazy { WaypointMissionManager.getInstance() }
    private var webSocketBridge: GeoMonitorWebSocketBridge? = null

    override fun onCreate() {
        super.onCreate()
        Log.i(TAG, "Starting DJI Mission Execution Background Service")
        setupTelemetryListeners()
        setupMissionStateListeners()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    /**
     * Listen to continuous real-time aircraft telemetry
     */
    private fun setupTelemetryListeners() {
        // 1. Aircraft 3D GPS Location (WGS84 Lat, Lon, AMSL Altitude)
        val locationKey = KeyTools.createKey(FlightControllerKey.KeyAircraftLocation3D)
        KeyManager.getInstance().listen(locationKey, this) { _, newValue ->
            newValue?.let { loc ->
                val payload = JSONObject().apply {
                    put("type", "TELEMETRY_UPDATE")
                    put("lat", loc.latitude)
                    put("lon", loc.longitude)
                    put("altitudeAmsl", loc.altitude)
                    put("timestamp", System.currentTimeMillis())
                }
                webSocketBridge?.sendTelemetry(payload.toString())
            }
        }

        // 2. Battery Percentage
        val batteryKey = KeyTools.createKey(BatteryKey.KeyBatteryState)
        KeyManager.getInstance().listen(batteryKey, this) { _, newValue ->
            newValue?.let { bat ->
                val payload = JSONObject().apply {
                    put("type", "BATTERY_UPDATE")
                    put("percent", bat.chargeRemainingInPercent)
                    put("voltageMv", bat.voltage)
                }
                webSocketBridge?.sendTelemetry(payload.toString())
            }
        }
    }

    /**
     * Listen to Waypoint Execution States
     */
    private fun setupMissionStateListeners() {
        missionManager.addWaypointMissionExecuteStateListener(object : WaypointMissionExecuteStateListener {
            override fun onMissionExecStateUpdate(state: WaypointMissionExecuteState) {
                Log.i(TAG, "Waypoint Mission State Changed: $state")
                val statePayload = JSONObject().apply {
                    put("type", "MISSION_STATE_UPDATE")
                    put("state", state.name)
                }
                webSocketBridge?.sendStateUpdate(statePayload.toString())
            }
        })
    }

    /**
     * Upload KMZ Package to Aircraft Flash Memory
     */
    fun pushMissionToAircraft(kmzLocalPath: String, onComplete: (Boolean, String) -> Unit) {
        Log.i(TAG, "Pushing Mission KMZ to Aircraft Memory: $kmzLocalPath")
        missionManager.pushKMZFileToAircraft(kmzLocalPath, object : CommonCallbacks.CompletionCallback {
            override fun onSuccess() {
                Log.i(TAG, "Push to Aircraft: SUCCESS")
                onComplete(true, "MISSION_UPLOADED_TO_AIRCRAFT_OK")
            }

            override fun onFailure(error: IDJIError) {
                Log.e(TAG, "Push to Aircraft FAILED: ${error.description()}")
                onComplete(false, error.description() ?: "UPLOAD_ERROR")
            }
        })
    }

    /**
     * Start Autonomous Mission (Gated by Operator Confirmation)
     */
    fun startMission(missionFileName: String, onResult: (Boolean, String) -> Unit) {
        Log.i(TAG, "Starting Execution of Mission: $missionFileName")
        missionManager.startMission(missionFileName, mutableListOf(), object : CommonCallbacks.CompletionCallback {
            override fun onSuccess() {
                Log.i(TAG, "Mission Start: SUCCESS")
                onResult(true, "EXECUTION_STARTED")
            }

            override fun onFailure(error: IDJIError) {
                Log.e(TAG, "Mission Start FAILED: ${error.description()}")
                onResult(false, error.description() ?: "START_FAILED")
            }
        })
    }

    /**
     * Operational Pause (Drone will hover immediately at current coordinates)
     */
    fun pauseMission(onResult: (Boolean, String) -> Unit) {
        missionManager.pauseMission(object : CommonCallbacks.CompletionCallback {
            override fun onSuccess() = onResult(true, "MISSION_PAUSED")
            override fun onFailure(error: IDJIError) = onResult(false, error.description())
        })
    }

    /**
     * Resume Mission from Breakpoint
     */
    fun resumeMission(onResult: (Boolean, String) -> Unit) {
        missionManager.resumeMission(object : CommonCallbacks.CompletionCallback {
            override fun onSuccess() = onResult(true, "MISSION_RESUMED")
            override fun onFailure(error: IDJIError) = onResult(false, error.description())
        })
    }

    /**
     * Emergency Stop (Drone cancels waypoint mission and enters RTH)
     */
    fun stopMission(onResult: (Boolean, String) -> Unit) {
        missionManager.stopMission(object : CommonCallbacks.CompletionCallback {
            override fun onSuccess() = onResult(true, "MISSION_STOPPED_RTH")
            override fun onFailure(error: IDJIError) = onResult(false, error.description())
        })
    }
}
