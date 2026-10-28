package com.geomonitor.dronebridge

import android.app.Application
import android.util.Log
import dji.v5.common.callback.CommonCallbacks
import dji.v5.common.error.IDJIError
import dji.v5.manager.DJISDKManager
import dji.v5.manager.interfaces.SDKManagerCallback

class DJIBridgeApplication : Application() {

    companion object {
        private const val TAG = "GeoMonitorDJIBridge"
    }

    override fun onCreate() {
        super.onCreate()
        initDJISDK()
    }

    private fun initDJISDK() {
        Log.i(TAG, "Initializing DJI Mobile SDK V5 for Android (Target: DJI Mini 4 Pro / RC-N2)...")
        DJISDKManager.getInstance().init(this, object : SDKManagerCallback {
            override fun onRegisterSuccess() {
                Log.i(TAG, "DJI Mobile SDK V5 Registration: SUCCESS")
            }

            override fun onRegisterFailure(error: IDJIError) {
                Log.e(TAG, "DJI Mobile SDK V5 Registration Failed: ${error.description()}")
            }

            override fun onProductDisconnect(product: Int) {
                Log.w(TAG, "Aircraft Disconnected (Product Code: $product)")
            }

            override fun onProductConnect(product: Int) {
                Log.i(TAG, "Aircraft Connected: Product Code: $product (RC-N2 USB Active)")
            }

            override fun onProductChanged(product: Int) {
                Log.i(TAG, "Aircraft Model Changed: $product")
            }

            override fun onInitProcess(event: dji.v5.manager.interfaces.DJISDKInitEvent, totalProcess: Int) {
                Log.d(TAG, "SDK Init Progress: $event ($totalProcess)")
            }

            override fun onDatabaseDownloadProgress(current: Long, total: Long) {}
        })
    }
}
