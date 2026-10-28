'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import {
  MAP_BEARING,
  DEFAULT_MAP_CENTER,
  CameraState,
  validateCameraState,
} from '@geomonitor/shared';

interface SharedMapContextType {
  sceneMode: '2D' | '3D';
  setSceneMode: (mode: '2D' | '3D') => void;
  toggleSceneMode: () => void;
  currentCamera: CameraState | null;
  updateCameraState: (state: Partial<CameraState>) => void;
  selectedAreaId: string | null;
  setSelectedAreaId: (id: string | null) => void;
  isCameraInitialized: boolean;
  setCameraInitialized: (val: boolean) => void;
  hasUserAdjustedCamera: boolean;
  setHasUserAdjustedCamera: (val: boolean) => void;
  resetTo2DView: () => void;
}

const SharedMapContext = createContext<SharedMapContextType | null>(null);

export function SharedMapProvider({ children }: { children: React.ReactNode }) {
  // 1. Scene Mode: Master default is 2D across all modules per specification
  const [sceneMode, setSceneModeState] = useState<'2D' | '3D'>('2D');

  // 2. Selected Area ID across the system
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);

  // 3. Camera Initialized Flag (prevents async data/GPS from overwriting initial view)
  const [isCameraInitialized, setCameraInitialized] = useState<boolean>(false);

  // 4. User Adjusted Camera Flag (prevents auto flyTo when user is inspecting)
  const [hasUserAdjustedCamera, setHasUserAdjustedCamera] = useState<boolean>(false);

  // 5. Shared Camera State: Initialized with verified 2D Nadir view
  const [currentCamera, setCurrentCamera] = useState<CameraState | null>(() => {
    // Validated 2D Nadir default
    const initial: CameraState = {
      longitude: DEFAULT_MAP_CENTER.longitude,
      latitude: DEFAULT_MAP_CENTER.latitude,
      height: 8000,
      heading: MAP_BEARING.CESIUM_DEG,
      pitch: -90, // Strict top-down vertical nadir
      sceneMode: '2D',
    };
    return validateCameraState(initial) ? initial : null;
  });

  const setSceneMode = useCallback((mode: '2D' | '3D') => {
    setSceneModeState(mode);
    setCurrentCamera((prev) => (prev ? { ...prev, sceneMode: mode } : null));
  }, []);

  const toggleSceneMode = useCallback(() => {
    setSceneModeState((prev) => {
      const next = prev === '2D' ? '3D' : '2D';
      setCurrentCamera((c) => (c ? { ...c, sceneMode: next } : null));
      return next;
    });
  }, []);

  const updateCameraState = useCallback((partial: Partial<CameraState>) => {
    setCurrentCamera((prev) => {
      const merged: CameraState = {
        longitude: partial.longitude ?? prev?.longitude ?? DEFAULT_MAP_CENTER.longitude,
        latitude: partial.latitude ?? prev?.latitude ?? DEFAULT_MAP_CENTER.latitude,
        height: partial.height ?? prev?.height ?? 8000,
        heading: partial.heading ?? prev?.heading ?? MAP_BEARING.CESIUM_DEG,
        pitch: partial.pitch ?? prev?.pitch ?? -90,
        sceneMode: partial.sceneMode ?? prev?.sceneMode ?? '2D',
      };
      if (validateCameraState(merged)) {
        return merged;
      }
      return prev;
    });
  }, []);

  const resetTo2DView = useCallback(() => {
    setSceneModeState('2D');
    setHasUserAdjustedCamera(false);
    setCurrentCamera((prev) => ({
      longitude: prev?.longitude ?? DEFAULT_MAP_CENTER.longitude,
      latitude: prev?.latitude ?? DEFAULT_MAP_CENTER.latitude,
      height: Math.min(Math.max(prev?.height ?? 2500, 1500), 10000),
      heading: MAP_BEARING.CESIUM_DEG, // -90° (270°)
      pitch: -90, // 2D top-down nadir
      sceneMode: '2D',
    }));
  }, []);

  return (
    <SharedMapContext.Provider
      value={{
        sceneMode,
        setSceneMode,
        toggleSceneMode,
        currentCamera,
        updateCameraState,
        selectedAreaId,
        setSelectedAreaId,
        isCameraInitialized,
        setCameraInitialized,
        hasUserAdjustedCamera,
        setHasUserAdjustedCamera,
        resetTo2DView,
      }}
    >
      {children}
    </SharedMapContext.Provider>
  );
}

export function useSharedMap() {
  const ctx = useContext(SharedMapContext);
  if (!ctx) {
    throw new Error('useSharedMap must be used within a SharedMapProvider');
  }
  return ctx;
}

