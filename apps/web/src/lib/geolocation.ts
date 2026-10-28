/**
 * Device Geolocation Service & Hook for GeoMonitor 3D
 * Provides automatic device GPS detection, caching, and reactive subscriptions.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

export interface DeviceGpsLocation {
  longitude: number;
  latitude: number;
  altitude?: number | null;
  accuracy: number;
  altitudeAccuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
  timestamp: number;
}

export type GeolocationStatus = 'idle' | 'locating' | 'success' | 'error' | 'unsupported';

export interface GeolocationState {
  location: DeviceGpsLocation | null;
  status: GeolocationStatus;
  errorMessage: string | null;
}

// Global cached location to share across page navigations without re-prompting
let cachedDeviceLocation: DeviceGpsLocation | null = null;
const listeners = new Set<(loc: DeviceGpsLocation) => void>();

/**
 * Get device GPS coordinates as a Promise
 */
export async function getDeviceLocation(options?: PositionOptions): Promise<DeviceGpsLocation> {
  if (typeof window === 'undefined' || !navigator.geolocation) {
    throw new Error('Geolocation is not supported in this environment');
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const location: DeviceGpsLocation = {
          longitude: Number(pos.coords.longitude.toFixed(6)),
          latitude: Number(pos.coords.latitude.toFixed(6)),
          altitude: pos.coords.altitude,
          accuracy: Math.round(pos.coords.accuracy || 15),
          altitudeAccuracy: pos.coords.altitudeAccuracy,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
          timestamp: pos.timestamp,
        };
        cachedDeviceLocation = location;
        listeners.forEach((fn) => fn(location));
        resolve(location);
      },
      (err) => {
        reject(err);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
        ...options,
      }
    );
  });
}

/**
 * Generate a rectangular survey polygon centered around given GPS coordinates
 * @param centerLon Longitude of center point
 * @param centerLat Latitude of center point
 * @param widthMeters Width of the bounding area in meters (default 250m)
 * @param heightMeters Height of the bounding area in meters (default 200m)
 */
export function generateDefaultSurveyPolygon(
  centerLon: number,
  centerLat: number,
  widthMeters = 250,
  heightMeters = 200
): [number, number][] {
  // Approximate conversion at center latitude:
  // 1 deg latitude ≈ 111,320 m
  // 1 deg longitude ≈ 111,320 * cos(lat) m
  const latDelta = (heightMeters / 2) / 111320;
  const lonDelta = (widthMeters / 2) / (111320 * Math.cos((centerLat * Math.PI) / 180));

  const minLon = Number((centerLon - lonDelta).toFixed(6));
  const maxLon = Number((centerLon + lonDelta).toFixed(6));
  const minLat = Number((centerLat - latDelta).toFixed(6));
  const maxLat = Number((centerLat + latDelta).toFixed(6));

  // Counter-clockwise polygon ring
  return [
    [minLon, minLat],
    [maxLon, minLat],
    [maxLon, maxLat],
    [minLon, maxLat],
  ];
}

/**
 * React hook to automatically detect and track device GPS location upon mounting
 */
export function useDeviceLocation(options?: { autoDetect?: boolean }) {
  const { autoDetect = true } = options || {};
  const [state, setState] = useState<GeolocationState>({
    location: cachedDeviceLocation,
    status: cachedDeviceLocation ? 'success' : 'idle',
    errorMessage: null,
  });

  const detectLocation = useCallback(async () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setState({
        location: null,
        status: 'unsupported',
        errorMessage: 'เบราว์เซอร์นี้ไม่รองรับ Geolocation API',
      });
      return;
    }

    setState((prev) => ({ ...prev, status: 'locating', errorMessage: null }));

    try {
      const loc = await getDeviceLocation();
      setState({
        location: loc,
        status: 'success',
        errorMessage: null,
      });
      return loc;
    } catch (err: any) {
      const msg =
        err.code === 1
          ? 'ผู้ใช้ปฏิเสธการเข้าถึงพิกัด GPS'
          : err.code === 2
          ? 'ไม่สามารถระบุตำแหน่งของอุปกรณ์ได้'
          : 'หมดเวลาตรวจจับพิกัด GPS';
      setState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: msg,
      }));
      return null;
    }
  }, []);

  useEffect(() => {
    const listener = (loc: DeviceGpsLocation) => {
      setState({ location: loc, status: 'success', errorMessage: null });
    };
    listeners.add(listener);

    if (autoDetect && !cachedDeviceLocation) {
      detectLocation();
    }

    return () => {
      listeners.delete(listener);
    };
  }, [autoDetect, detectLocation]);

  return {
    ...state,
    detectLocation,
    cachedLocation: cachedDeviceLocation,
  };
}
