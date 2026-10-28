plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.geomonitor.dronebridge"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.geomonitor.dronebridge"
        minSdk = 28 // Android 9.0 (Required by DJI Mobile SDK V5)
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"

        ndk {
            abiFilters.addAll(setOf("arm64-v8a", "armeabi-v7a"))
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    // DJI Mobile SDK V5 for Android
    implementation("com.dji:dji-sdk-v5-aircraft:5.13.0")
    compileOnly("com.dji:dji-sdk-v5-aircraft-provided:5.13.0")

    // AndroidX & Core
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("com.google.android.material:material:1.11.0")

    // Coroutines & Lifecycle
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")
    implementation("androidx.lifecycle:lifecycle-service:2.7.0")

    // OkHttp WebSocket for Real-time Cloud Telemetry Bridge
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.google.code.gson:gson:2.10.1")
}
