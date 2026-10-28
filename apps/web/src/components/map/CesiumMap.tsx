'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as Cesium from 'cesium';
import {
  Layers,
  Compass,
  Maximize2,
  Ruler,
  Eye,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Crosshair,
  Shapes,
  Trash2,
  Sliders,
  Mountain,
  Plane,
  Home,
  CheckCircle2,
  LocateFixed,
  MapPin,
} from 'lucide-react';
import { formatAreaThai, DroneWaypointDTO, toSignedBearing } from '@geomonitor/shared';
import {
  FlightLineSegment,
  PhotoCapturePosition,
  CameraFootprintBox,
} from '@/lib/drone-route-generator';
import ChangeLegend from './ChangeLegend';
import GoogleEarthCompass from './GoogleEarthCompass';
import {
  calculateGeodesicDistance,
  calculatePathLength,
  calculateSphericalPolygonArea,
  formatAreaDetailed,
} from '@/lib/gis-engine';
import { getDeviceLocation } from '@/lib/geolocation';

// Configure Cesium Base URL
if (typeof window !== 'undefined') {
  (window as any).CESIUM_BASE_URL = '/cesium';
}

export interface AreaFeature {
  id: string;
  name: string;
  areaSqm: number;
  status: string;
  boundary: {
    type: 'Polygon';
    coordinates: number[][][];
  };
}

export interface ChangePolygonFeature {
  id: string;
  featureType: string;
  areaSqm: number;
  meanElevationChangeM: number | null;
  estimatedVolumeM3: number | null;
  isConfirmed: boolean;
  confidence?: number;
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
}

export interface LayerSettings {
  orthoVisible?: boolean;
  orthoOpacity?: number;
  dsmVisible?: boolean;
  dsmOpacity?: number;
  meshVisible?: boolean;
  meshOpacity?: number;
}

export type DroneInteractionMode =
  | 'none'
  | 'draw_polygon'
  | 'set_home'
  | 'set_takeoff'
  | 'set_landing';

export interface CesiumMapProps {
  areas?: AreaFeature[];
  selectedAreaId?: string | null;
  onSelectArea?: (areaId: string) => void;
  changeFeatures?: ChangePolygonFeature[];
  savedViewKey?: string | null;
  layerSettings?: LayerSettings;

  // Unified Drone Mission Planner Props
  dronePolygon?: [number, number][]; // [lon, lat]
  droneWaypoints?: DroneWaypointDTO[];
  droneFlightLines?: FlightLineSegment[];
  dronePhotoPositions?: PhotoCapturePosition[];
  droneSampleFootprints?: CameraFootprintBox[];
  droneHomePoint?: [number, number, number] | null; // [lon, lat, alt]
  droneTakeoffPoint?: [number, number, number] | null;
  droneLandingPoint?: [number, number, number] | null;
  droneAltitudeReference?: 'relative_to_home' | 'agl' | 'amsl';
  droneTargetAltitudeM?: number;
  droneInteractionMode?: DroneInteractionMode;
  onDronePolygonChange?: (poly: [number, number][]) => void;
  onDroneHomePointChange?: (pt: [number, number, number]) => void;
  onDroneTakeoffPointChange?: (pt: [number, number, number]) => void;
  onDroneLandingPointChange?: (pt: [number, number, number]) => void;
  selectedDroneWaypointIndex?: number | null;
  onSelectDroneWaypoint?: (idx: number | null) => void;
  onUserLocationDetected?: (coords: { longitude: number; latitude: number; accuracy: number }) => void;
}

export default function CesiumMap({
  areas = [],
  selectedAreaId,
  onSelectArea,
  changeFeatures = [],
  savedViewKey,
  layerSettings = {
    orthoVisible: true,
    orthoOpacity: 100,
    dsmVisible: true,
    dsmOpacity: 80,
    meshVisible: true,
    meshOpacity: 90,
  },
  dronePolygon = [],
  droneWaypoints = [],
  droneFlightLines = [],
  dronePhotoPositions = [],
  droneSampleFootprints = [],
  droneHomePoint = null,
  droneTakeoffPoint = null,
  droneLandingPoint = null,
  droneAltitudeReference = 'relative_to_home',
  droneTargetAltitudeM = 80,
  droneInteractionMode = 'none',
  onDronePolygonChange,
  onDroneHomePointChange,
  onDroneTakeoffPointChange,
  onDroneLandingPointChange,
  selectedDroneWaypointIndex = null,
  onSelectDroneWaypoint,
  onUserLocationDetected,
}: CesiumMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);

  // Drone Entities Tracking
  const dronePolygonEntityRef = useRef<Cesium.Entity | null>(null);
  const droneRouteEntityRef = useRef<Cesium.Entity | null>(null);
  const droneTransitEntityRef = useRef<Cesium.Entity | null>(null);
  const droneWaypointEntitiesRef = useRef<Cesium.Entity[]>([]);
  const droneMarkerEntitiesRef = useRef<Cesium.Entity[]>([]);
  const droneFlightLinesEntitiesRef = useRef<Cesium.Entity[]>([]);
  const dronePhotoEntitiesRef = useRef<Cesium.Entity[]>([]);
  const droneFootprintEntitiesRef = useRef<Cesium.Entity[]>([]);
  const droneTempDrawEntityRef = useRef<Cesium.Entity | null>(null);
  const [droneDrawingPoints, setDroneDrawingPoints] = useState<[number, number][]>([]);

  // User Device GPS Tracking State
  const [userGps, setUserGps] = useState<{ lon: number; lat: number; accuracy: number } | null>(null);
  const [isLocatingGps, setIsLocatingGps] = useState<boolean>(false);
  const userGpsEntityRef = useRef<Cesium.Entity | null>(null);
  const userGpsCircleEntityRef = useRef<Cesium.Entity | null>(null);

  // Master Contract Section 3: Initial Map Bearing = -90° (270° in Cesium 0-360 range)
  const initialMapBearing = -90;
  const initialMapBearingRad = Cesium.Math.toRadians(270);
  const [mapViewBearing, setMapViewBearing] = useState<number>(initialMapBearing);

  // Real-time coordinates state (including ground elevation probe)
  const [coords, setCoords] = useState<{
    lat: number;
    lon: number;
    groundElevation: number;
    cameraHeight: number;
    heading: number;
    pitch: number;
  }>({
    lat: 13.7563,
    lon: 100.5018,
    groundElevation: 10,
    cameraHeight: 5000,
    heading: initialMapBearing,
    pitch: -50,
  });

  // Locate User Device via Geolocation Lib
  const locateUserDevice = useCallback(async (flyCamera = true) => {
    setIsLocatingGps(true);
    try {
      const loc = await getDeviceLocation();
      setIsLocatingGps(false);
      setUserGps({ lon: loc.longitude, lat: loc.latitude, accuracy: loc.accuracy });
      onUserLocationDetected?.({ longitude: loc.longitude, latitude: loc.latitude, accuracy: loc.accuracy });

      const viewer = viewerRef.current;
      if (viewer && !viewer.isDestroyed() && flyCamera) {
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(loc.longitude, loc.latitude, 2000),
          orientation: {
            heading: initialMapBearingRad,
            pitch: Cesium.Math.toRadians(-45),
            roll: 0,
          },
          duration: 1.8,
        });
      }
    } catch (err: any) {
      setIsLocatingGps(false);
      console.warn('GPS detection failed or permission denied:', err?.message);
    }
  }, [onUserLocationDetected]);

  // Layer Toggles
  const [visibleLayers, setVisibleLayers] = useState({
    cut: true,
    fill: true,
    construction: true,
    boundary: true,
  });

  // Measurement State
  const [measureMode, setMeasureMode] = useState<'none' | 'distance' | 'area'>('none');
  const [measureCoords, setMeasureCoords] = useState<[number, number][]>([]);
  const [measurementResult, setMeasurementResult] = useState<{
    primary: string;
    secondary?: string;
  } | null>(null);

  // 2D / 3D Scene Mode State
  const [sceneMode, setSceneMode] = useState<'3D' | '2D'>('3D');

  // Toggle Layer Callback
  const handleToggleLayer = (key: 'cut' | 'fill' | 'construction' | 'boundary') => {
    setVisibleLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Toggle 2D / 3D Scene Mode
  const handleToggleSceneMode = useCallback(() => {
    const v = viewerRef.current;
    if (!v || v.isDestroyed()) return;

    if (sceneMode === '3D') {
      v.scene.morphTo2D(1.0);
      setSceneMode('2D');
    } else {
      v.scene.morphTo3D(1.0);
      setSceneMode('3D');
    }
  }, [sceneMode]);

  // Google Earth Pro Navigation Handlers: Reset to Initial Map Bearing (-90°)
  const handleResetNorth = useCallback(() => {
    const v = viewerRef.current;
    if (!v || v.isDestroyed()) return;
    v.camera.flyTo({
      destination: v.camera.position,
      orientation: {
        heading: initialMapBearingRad,
        pitch: v.camera.pitch,
        roll: 0,
      },
      duration: 0.8,
    });
    setMapViewBearing(initialMapBearing);
  }, [initialMapBearing, initialMapBearingRad]);

  const handleResetNadir = useCallback(() => {
    const v = viewerRef.current;
    if (!v || v.isDestroyed()) return;
    v.camera.flyTo({
      destination: v.camera.position,
      orientation: {
        heading: v.camera.heading,
        pitch: Cesium.Math.toRadians(-89.9), // Nadir top-down
        roll: 0,
      },
      duration: 0.8,
    });
  }, []);

  const handlePan = useCallback((direction: 'north' | 'south' | 'east' | 'west') => {
    const v = viewerRef.current;
    if (!v || v.isDestroyed()) return;
    const height = v.camera.positionCartographic.height;
    const moveRate = height * 0.25;

    switch (direction) {
      case 'north':
        v.camera.moveUp(moveRate);
        break;
      case 'south':
        v.camera.moveDown(moveRate);
        break;
      case 'east':
        v.camera.moveRight(moveRate);
        break;
      case 'west':
        v.camera.moveLeft(moveRate);
        break;
    }
  }, []);

  const handleZoomIn = useCallback(() => {
    const v = viewerRef.current;
    if (!v || v.isDestroyed()) return;
    v.camera.zoomIn(v.camera.positionCartographic.height * 0.35);
  }, []);

  const handleZoomOut = useCallback(() => {
    const v = viewerRef.current;
    if (!v || v.isDestroyed()) return;
    v.camera.zoomOut(v.camera.positionCartographic.height * 0.45);
  }, []);

  const handleRotateHeading = useCallback((deltaDeg: number) => {
    const v = viewerRef.current;
    if (!v || v.isDestroyed()) return;
    const currentHeading = Cesium.Math.toDegrees(v.camera.heading);
    const newHeading = Cesium.Math.toRadians(currentHeading + deltaDeg);
    v.camera.setView({
      orientation: {
        heading: newHeading,
        pitch: v.camera.pitch,
        roll: 0,
      },
    });
  }, []);

  // Initialize Viewer
  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;

    try {
      // 1. Safely configure Cesium Ion Access Token if provided in environment
      const ionToken = (process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN || '').trim();
      if (ionToken) {
        Cesium.Ion.defaultAccessToken = ionToken;
      }

      // 2. Initialize Viewer with baseLayer: false to prevent default unauthorized Cesium Ion World Imagery (Asset ID 2) requests
      const viewer = new Cesium.Viewer(containerRef.current, {
        animation: false,
        baseLayerPicker: false,
        baseLayer: false,
        fullscreenButton: false,
        geocoder: false,
        homeButton: false,
        infoBox: false,
        sceneModePicker: false,
        selectionIndicator: false,
        timeline: false,
        navigationHelpButton: false,
        scene3DOnly: false,
        terrainProvider: new Cesium.EllipsoidTerrainProvider(),
      });

      viewer.scene.globe.enableLighting = false;
      viewer.scene.globe.depthTestAgainstTerrain = true;
      viewer.scene.screenSpaceCameraController.maximumZoomDistance = 5000000;
      viewer.scene.screenSpaceCameraController.minimumZoomDistance = 10;

      // 3. Base Imagery: High resolution Esri satellite with error handling
      const baseImagery = new Cesium.UrlTemplateImageryProvider({
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        maximumLevel: 19,
        credit: new Cesium.Credit('Esri World Imagery'),
      });

      // Handle tile load errors gracefully
      baseImagery.errorEvent.addEventListener((error: any) => {
        console.warn('[Cesium BaseImagery Warning] Tile request error:', error?.message || error);
      });

      viewer.imageryLayers.removeAll();
      const imageryLayer = viewer.imageryLayers.addImageryProvider(baseImagery);
      imageryLayer.alpha = (layerSettings.orthoOpacity ?? 100) / 100;
      imageryLayer.show = layerSettings.orthoVisible !== false;

      // Dynamic Device GPS Detection on Camera Init (Replaces hardcoded Rayong)
      if (typeof window !== 'undefined' && navigator.geolocation) {
        setIsLocatingGps(true);
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setIsLocatingGps(false);
            const lon = Number(pos.coords.longitude.toFixed(6));
            const lat = Number(pos.coords.latitude.toFixed(6));
            const accuracy = Math.round(pos.coords.accuracy || 15);
            setUserGps({ lon, lat, accuracy });
            onUserLocationDetected?.({ longitude: lon, latitude: lat, accuracy });

            if (viewer && !viewer.isDestroyed()) {
              viewer.camera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(lon, lat, 2000),
                orientation: {
                  heading: initialMapBearingRad,
                  pitch: Cesium.Math.toRadians(-45),
                  roll: 0,
                },
                duration: 1.5,
              });
            }
          },
          (err) => {
            setIsLocatingGps(false);
            console.warn('GPS initial detection fallback:', err.message);
            // Fallback view: Thailand center / Bangkok
            if (viewer && !viewer.isDestroyed()) {
              viewer.camera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(100.5018, 13.7563, 10000),
                orientation: {
                  heading: initialMapBearingRad,
                  pitch: Cesium.Math.toRadians(-50),
                  roll: 0,
                },
                duration: 0,
              });
            }
          },
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
        );
      } else {
        // Fallback view: Thailand center / Bangkok
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(100.5018, 13.7563, 10000),
          orientation: {
            heading: initialMapBearingRad,
            pitch: Cesium.Math.toRadians(-50),
            roll: 0,
          },
          duration: 0,
        });
      }

      // Mouse Move Listener for Coordinates & Elevation Display
      const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction((movement: any) => {
        let cartesian: Cesium.Cartesian3 | undefined;
        if (viewer.scene.pickPositionSupported) {
          cartesian = viewer.scene.pickPosition(movement.endPosition);
        }
        if (!cartesian) {
          cartesian = viewer.camera.pickEllipsoid(movement.endPosition, viewer.scene.globe.ellipsoid);
        }

        if (cartesian) {
          const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
          const rawHeight = cartographic.height;
          // Approximate realistic coastal elevation if ellipsoid return is 0
          const groundElev = Math.max(0, Math.round(rawHeight));

          setCoords({
            lat: Number(Cesium.Math.toDegrees(cartographic.latitude).toFixed(5)),
            lon: Number(Cesium.Math.toDegrees(cartographic.longitude).toFixed(5)),
            groundElevation: groundElev,
            cameraHeight: Math.round(viewer.camera.positionCartographic.height),
            heading: Math.round(Cesium.Math.toDegrees(viewer.camera.heading)),
            pitch: Math.round(Cesium.Math.toDegrees(viewer.camera.pitch)),
          });
        }
      }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

      // Left Click for Area Selection
      handler.setInputAction((click: any) => {
        const pickedObject = viewer.scene.pick(click.position);
        if (Cesium.defined(pickedObject) && pickedObject.id && pickedObject.id.properties) {
          const areaId = pickedObject.id.properties.areaId?.getValue();
          if (areaId && onSelectArea) {
            onSelectArea(areaId);
          }
        }
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

      viewerRef.current = viewer;

      return () => {
        handler.destroy();
        if (!viewer.isDestroyed()) {
          viewer.destroy();
        }
        viewerRef.current = null;
      };
    } catch (err) {
      console.error('[Cesium Init Error]', err);
    }
  }, []);

  // Sync Layer Opacity & Visibility with Base Imagery
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    if (viewer.imageryLayers.length > 0) {
      const baseLayer = viewer.imageryLayers.get(0);
      if (baseLayer) {
        baseLayer.show = layerSettings.orthoVisible !== false;
        baseLayer.alpha = (layerSettings.orthoOpacity ?? 100) / 100;
      }
    }
  }, [layerSettings.orthoVisible, layerSettings.orthoOpacity]);

  // Global Keyboard Navigation (Google Earth Pro shortcuts)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if typing in an input or textarea
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      const v = viewerRef.current;
      if (!v || v.isDestroyed()) return;

      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        handleResetNorth();
      } else if (e.key === 'r' || e.key === 'R' || e.key === 'u' || e.key === 'U') {
        e.preventDefault();
        handleResetNadir();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        handlePan('north');
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        handlePan('south');
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePan('west');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handlePan('east');
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        handleZoomIn();
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        handleZoomOut();
      } else if (e.key === '[') {
        e.preventDefault();
        handleRotateHeading(-10);
      } else if (e.key === ']') {
        e.preventDefault();
        handleRotateHeading(10);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleResetNorth, handleResetNadir, handlePan, handleZoomIn, handleZoomOut, handleRotateHeading]);

  // Handle Measurement Tool Click on Canvas with Real GIS Math
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || measureMode === 'none') return;

    const measureHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    measureHandler.setInputAction((click: any) => {
      let cartesian: Cesium.Cartesian3 | undefined;
      if (viewer.scene.pickPositionSupported) {
        cartesian = viewer.scene.pickPosition(click.position);
      }
      if (!cartesian) {
        cartesian = viewer.camera.pickEllipsoid(click.position, viewer.scene.globe.ellipsoid);
      }
      if (!cartesian) return;

      const carto = Cesium.Cartographic.fromCartesian(cartesian);
      const lon = Number(Cesium.Math.toDegrees(carto.longitude).toFixed(6));
      const lat = Number(Cesium.Math.toDegrees(carto.latitude).toFixed(6));

      setMeasureCoords((prev) => {
        const updated = [...prev, [lon, lat] as [number, number]];

        // Draw pin entity
        viewer.entities.add({
          id: `measure-pin-${Date.now()}`,
          position: cartesian,
          point: {
            pixelSize: 10,
            color: Cesium.Color.fromCssColorString('#06b6d4'),
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 2,
          },
        });

        if (measureMode === 'distance' && updated.length >= 2) {
          // Calculate true geodesic distance
          const totalDistanceM = calculatePathLength(updated);
          const lastSegmentDistM = calculateGeodesicDistance(
            updated[updated.length - 2][0],
            updated[updated.length - 2][1],
            updated[updated.length - 1][0],
            updated[updated.length - 1][1]
          );

          // Add polyline entity
          const cartesianPositions = updated.map(([ln, lt]) =>
            Cesium.Cartesian3.fromDegrees(ln, lt, 5)
          );

          // Remove prior measure lines and draw complete path
          const toRemove: Cesium.Entity[] = [];
          viewer.entities.values.forEach((e) => {
            if (e.id.startsWith('measure-path-')) toRemove.push(e);
          });
          toRemove.forEach((e) => viewer.entities.remove(e));

          viewer.entities.add({
            id: `measure-path-${Date.now()}`,
            polyline: {
              positions: cartesianPositions,
              width: 3,
              material: Cesium.Color.fromCssColorString('#00f5d4'),
            },
          });

          setMeasurementResult({
            primary: `ระยะทางรวม (Geodesic): ${totalDistanceM.toFixed(1)} ม. (${(totalDistanceM / 1000).toFixed(2)} กม.)`,
            secondary: `ช่วงล่าสุด: ${lastSegmentDistM.toFixed(1)} ม. | จำนวนจุด: ${updated.length} จุด`,
          });
        } else if (measureMode === 'area' && updated.length >= 3) {
          // Calculate true spherical polygon area
          const areaSqm = calculateSphericalPolygonArea(updated);
          const detailed = formatAreaDetailed(areaSqm);
          const perimeterM = calculatePathLength([...updated, updated[0]]);

          // Render polygon preview
          const flatDegrees = updated.flatMap(([ln, lt]) => [ln, lt]);
          const toRemove: Cesium.Entity[] = [];
          viewer.entities.values.forEach((e) => {
            if (e.id.startsWith('measure-poly-')) toRemove.push(e);
          });
          toRemove.forEach((e) => viewer.entities.remove(e));

          viewer.entities.add({
            id: `measure-poly-${Date.now()}`,
            polygon: {
              hierarchy: Cesium.Cartesian3.fromDegreesArray(flatDegrees),
              material: Cesium.Color.fromCssColorString('rgba(6, 182, 212, 0.35)'),
              outline: true,
              outlineColor: Cesium.Color.fromCssColorString('#22d3ee'),
              outlineWidth: 2,
            },
          });

          setMeasurementResult({
            primary: `พื้นที่ (WGS84): ${detailed.formattedMetric}`,
            secondary: `มาตราวัดไทย: ${detailed.formattedThai} | เส้นรอบรูป: ${perimeterM.toFixed(1)} ม.`,
          });
        }

        return updated;
      });
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    return () => {
      measureHandler.destroy();
    };
  }, [measureMode]);

  const clearMeasurements = () => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const toRemove: Cesium.Entity[] = [];
    viewer.entities.values.forEach((e) => {
      if (e.id.startsWith('measure-')) toRemove.push(e);
    });
    toRemove.forEach((e) => viewer.entities.remove(e));
    setMeasureCoords([]);
    setMeasurementResult(null);
    setMeasureMode('none');
  };

  // Render Managed Area Boundaries
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const entitiesToRemove: Cesium.Entity[] = [];
    viewer.entities.values.forEach((e) => {
      if (e.id.startsWith('area-')) entitiesToRemove.push(e);
    });
    entitiesToRemove.forEach((e) => viewer.entities.remove(e));

    if (!visibleLayers.boundary) return;

    areas.forEach((area) => {
      const isSelected = area.id === selectedAreaId;
      const ring = area.boundary?.coordinates?.[0];
      if (!ring || ring.length < 3) return;

      const flatPositions: number[] = [];
      ring.forEach(([lon, lat]) => flatPositions.push(lon, lat));

      const boundaryPositions = ring.map(([lon, lat]) => Cesium.Cartesian3.fromDegrees(lon, lat, 0));
      boundaryPositions.push(Cesium.Cartesian3.fromDegrees(ring[0][0], ring[0][1], 0));

      viewer.entities.add({
        id: `area-${area.id}`,
        name: area.name,
        properties: new Cesium.PropertyBag({ areaId: area.id }),
        polygon: {
          hierarchy: Cesium.Cartesian3.fromDegreesArray(flatPositions),
          material: isSelected
            ? Cesium.Color.fromCssColorString('rgba(6, 182, 212, 0.45)')
            : Cesium.Color.fromCssColorString('rgba(14, 165, 233, 0.22)'),
          classificationType: Cesium.ClassificationType.TERRAIN,
        },
        polyline: {
          positions: boundaryPositions,
          width: isSelected ? 3.5 : 2,
          material: isSelected
            ? Cesium.Color.fromCssColorString('#22d3ee')
            : Cesium.Color.fromCssColorString('#0284c7'),
          clampToGround: true,
        },
      });

      const centerLon = ring.reduce((sum, p) => sum + p[0], 0) / ring.length;
      const centerLat = ring.reduce((sum, p) => sum + p[1], 0) / ring.length;

      viewer.entities.add({
        id: `area-label-${area.id}`,
        position: Cesium.Cartesian3.fromDegrees(centerLon, centerLat, 0),
        label: {
          text: `${area.name}\n[${formatAreaThai(area.areaSqm)}]`,
          font: 'bold 12px Sarabun, sans-serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: 50000,
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(100, 50000),
          pixelOffset: new Cesium.Cartesian2(0, -10),
        },
      });
    });
  }, [areas, selectedAreaId, visibleLayers.boundary]);

  // Render Change Features (Cut/Fill Extruded 3D Polygons)
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const entitiesToRemove: Cesium.Entity[] = [];
    viewer.entities.values.forEach((e) => {
      if (e.id.startsWith('change-feat-')) entitiesToRemove.push(e);
    });
    entitiesToRemove.forEach((e) => viewer.entities.remove(e));

    changeFeatures.forEach((feat) => {
      const isCut = feat.featureType === 'earthwork_cut';
      const isFill = feat.featureType === 'earthwork_fill';

      if (isCut && !visibleLayers.cut) return;
      if (isFill && !visibleLayers.fill) return;
      if (!isCut && !isFill && !visibleLayers.construction) return;

      const ring = feat.geometry?.coordinates?.[0];
      if (!ring || ring.length < 3) return;

      const flatPositions: number[] = [];
      ring.forEach(([lon, lat]) => flatPositions.push(lon, lat));

      let fillColor = 'rgba(245, 158, 11, 0.5)';
      let outlineColor = '#f59e0b';
      let heightOffset = 12;

      if (isCut) {
        fillColor = 'rgba(244, 63, 94, 0.65)';
        outlineColor = '#f43f5e';
        heightOffset = Math.abs(feat.meanElevationChangeM || 4) * 4;
      } else if (isFill) {
        fillColor = 'rgba(16, 185, 129, 0.65)';
        outlineColor = '#10b981';
        heightOffset = Math.abs(feat.meanElevationChangeM || 3) * 4;
      }

      viewer.entities.add({
        id: `change-feat-${feat.id}`,
        name: isCut ? 'พื้นที่ขุดดิน (Cut)' : isFill ? 'พื้นที่ถมดิน (Fill)' : 'สิ่งปลูกสร้างใหม่',
        polygon: {
          hierarchy: Cesium.Cartesian3.fromDegreesArray(flatPositions),
          material: Cesium.Color.fromCssColorString(fillColor),
          extrudedHeight: heightOffset,
          outline: true,
          outlineColor: Cesium.Color.fromCssColorString(outlineColor),
          outlineWidth: 3,
        },
      });
    });
  }, [changeFeatures, visibleLayers]);

  // Handle Saved Camera Views
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !savedViewKey) return;

    if (savedViewKey === 'lng-terminal') {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(101.148, 12.671, 1800),
        orientation: { heading: Cesium.Math.toRadians(35), pitch: Cesium.Math.toRadians(-38), roll: 0 },
        duration: 1.5,
      });
    } else if (savedViewKey === 'cut-basin') {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(101.151, 12.676, 1200),
        orientation: { heading: Cesium.Math.toRadians(10), pitch: Cesium.Math.toRadians(-45), roll: 0 },
        duration: 1.5,
      });
    } else if (savedViewKey === 'reclamation-fill') {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(101.144, 12.673, 1400),
        orientation: { heading: Cesium.Math.toRadians(75), pitch: Cesium.Math.toRadians(-40), roll: 0 },
        duration: 1.5,
      });
    } else if (savedViewKey === 'overview-3d') {
      const destLon = userGps?.lon ?? 100.5018;
      const destLat = userGps?.lat ?? 13.7563;
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(destLon, destLat, userGps ? 2500 : 8000),
        orientation: { heading: initialMapBearingRad, pitch: Cesium.Math.toRadians(-50), roll: 0 },
        duration: 1.5,
      });
    } else if (savedViewKey === 'my-location') {
      locateUserDevice(true);
    } else if (savedViewKey.startsWith('coord-')) {
      const parts = savedViewKey.split('-');
      const lon = parseFloat(parts[1]);
      const lat = parseFloat(parts[2]);
      if (!isNaN(lon) && !isNaN(lat)) {
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(lon, lat, 2000),
          orientation: { heading: initialMapBearingRad, pitch: Cesium.Math.toRadians(-45), roll: 0 },
          duration: 1.5,
        });
      }
    }
  }, [savedViewKey, userGps, locateUserDevice]);

  // Render User Device GPS Location Marker on 3D Map
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    if (userGpsEntityRef.current) {
      viewer.entities.remove(userGpsEntityRef.current);
      userGpsEntityRef.current = null;
    }
    if (userGpsCircleEntityRef.current) {
      viewer.entities.remove(userGpsCircleEntityRef.current);
      userGpsCircleEntityRef.current = null;
    }

    if (!userGps) return;

    // Accuracy Circle
    userGpsCircleEntityRef.current = viewer.entities.add({
      name: 'User Device Accuracy Circle',
      position: Cesium.Cartesian3.fromDegrees(userGps.lon, userGps.lat, 1),
      ellipse: {
        semiMinorAxis: Math.max(userGps.accuracy, 25),
        semiMajorAxis: Math.max(userGps.accuracy, 25),
        material: Cesium.Color.fromCssColorString('rgba(6, 182, 212, 0.15)'),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString('#06B6D4'),
        outlineWidth: 2,
        height: 1,
      },
    });

    // Device Location Point and Label
    userGpsEntityRef.current = viewer.entities.add({
      name: 'User Device Location Marker',
      position: Cesium.Cartesian3.fromDegrees(userGps.lon, userGps.lat, 8),
      point: {
        pixelSize: 14,
        color: Cesium.Color.fromCssColorString('#06B6D4'),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 3,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: `📍 ตำแหน่งคอมพิวเตอร์ของคุณ\n(GPS: ${userGps.lat.toFixed(5)}, ${userGps.lon.toFixed(5)} ±${userGps.accuracy}m)`,
        font: 'bold 12px "Inter", "Sarabun", sans-serif',
        fillColor: Cesium.Color.fromCssColorString('#F8FAFC'),
        outlineColor: Cesium.Color.fromCssColorString('#090D16'),
        outlineWidth: 4,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -18),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
  }, [userGps]);

  // Render Drone Survey Polygon
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    if (dronePolygonEntityRef.current) {
      viewer.entities.remove(dronePolygonEntityRef.current);
      dronePolygonEntityRef.current = null;
    }

    if (dronePolygon && dronePolygon.length >= 3) {
      const positions = dronePolygon.map(([lon, lat]) => Cesium.Cartesian3.fromDegrees(lon, lat, 0));
      positions.push(Cesium.Cartesian3.fromDegrees(dronePolygon[0][0], dronePolygon[0][1], 0));

      dronePolygonEntityRef.current = viewer.entities.add({
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(positions),
          material: Cesium.Color.CYAN.withAlpha(0.12),
          classificationType: Cesium.ClassificationType.BOTH,
        },
        polyline: {
          positions,
          width: 2.5,
          material: new Cesium.PolylineDashMaterialProperty({
            color: Cesium.Color.CYAN,
            dashLength: 16.0,
          }),
          clampToGround: true,
        },
      });
    }
  }, [dronePolygon]);

  // Render Drone Flight Route, Waypoints & Pins
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    if (droneRouteEntityRef.current) {
      viewer.entities.remove(droneRouteEntityRef.current);
      droneRouteEntityRef.current = null;
    }
    if (droneTransitEntityRef.current) {
      viewer.entities.remove(droneTransitEntityRef.current);
      droneTransitEntityRef.current = null;
    }
    droneWaypointEntitiesRef.current.forEach((e) => viewer.entities.remove(e));
    droneWaypointEntitiesRef.current = [];
    droneMarkerEntitiesRef.current.forEach((e) => viewer.entities.remove(e));
    droneMarkerEntitiesRef.current = [];
    droneFlightLinesEntitiesRef.current.forEach((e) => viewer.entities.remove(e));
    droneFlightLinesEntitiesRef.current = [];
    dronePhotoEntitiesRef.current.forEach((e) => viewer.entities.remove(e));
    dronePhotoEntitiesRef.current = [];
    droneFootprintEntitiesRef.current.forEach((e) => viewer.entities.remove(e));
    droneFootprintEntitiesRef.current = [];

    // Home Point Marker
    if (droneHomePoint) {
      const homeEntity = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(droneHomePoint[0], droneHomePoint[1], droneHomePoint[2] || 0),
        point: {
          pixelSize: 16,
          color: Cesium.Color.fromCssColorString('#10B981'),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 3,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: 'HOME (H)',
          font: 'bold 12px Kanit, sans-serif',
          fillColor: Cesium.Color.WHITE,
          backgroundColor: Cesium.Color.fromCssColorString('#064E3B').withAlpha(0.85),
          showBackground: true,
          horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -14),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
      droneMarkerEntitiesRef.current.push(homeEntity);
    }

    // Takeoff Point Marker
    if (droneTakeoffPoint) {
      const takeoffEntity = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(droneTakeoffPoint[0], droneTakeoffPoint[1], droneTakeoffPoint[2] || 0),
        point: {
          pixelSize: 14,
          color: Cesium.Color.fromCssColorString('#06B6D4'),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: 'TAKEOFF (T)',
          font: '11px Kanit, sans-serif',
          fillColor: Cesium.Color.WHITE,
          backgroundColor: Cesium.Color.fromCssColorString('#083344').withAlpha(0.85),
          showBackground: true,
          horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -12),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
      droneMarkerEntitiesRef.current.push(takeoffEntity);
    }

    // 1. Render Sample Camera Footprint Polygons on Ground (Clamped to Terrain)
    if (droneSampleFootprints && droneSampleFootprints.length > 0) {
      droneSampleFootprints.forEach((box) => {
        const flatDegrees = box.corners.flatMap((c) => [c[0], c[1]]);
        const boxOutlinePositions = box.corners.map(([lon, lat]) => Cesium.Cartesian3.fromDegrees(lon, lat, 0));
        boxOutlinePositions.push(Cesium.Cartesian3.fromDegrees(box.corners[0][0], box.corners[0][1], 0));

        const fpEntity = viewer.entities.add({
          polygon: {
            hierarchy: Cesium.Cartesian3.fromDegreesArray(flatDegrees),
            material: Cesium.Color.fromCssColorString('#06B6D4').withAlpha(0.12),
            classificationType: Cesium.ClassificationType.TERRAIN,
          },
          polyline: {
            positions: boxOutlinePositions,
            width: 1.5,
            material: Cesium.Color.fromCssColorString('#22D3EE').withAlpha(0.5),
            clampToGround: true,
          },
        });
        droneFootprintEntitiesRef.current.push(fpEntity);
      });
    }

    // 2. Render Full Continuous Flight Route Polyline connecting all Waypoints
    if (droneWaypoints && droneWaypoints.length >= 2) {
      const routePositions = droneWaypoints.map((wp) =>
        Cesium.Cartesian3.fromDegrees(wp.longitude, wp.latitude, wp.altitudeMeters || droneTargetAltitudeM || 80)
      );

      droneRouteEntityRef.current = viewer.entities.add({
        name: 'Drone Mission Complete Flight Route',
        polyline: {
          positions: routePositions,
          width: 4.0,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.35,
            color: Cesium.Color.fromCssColorString('#06B6D4'),
          }),
        },
      });
    }

    // 2.1 Render Parallel Photogrammetry Flight Lines (Cyan for Pass A, Emerald for Pass B)
    if (droneFlightLines && droneFlightLines.length > 0) {
      droneFlightLines.forEach((line) => {
        const isPassB = line.passId === 'B';
        const lineEntity = viewer.entities.add({
          polyline: {
            positions: [
              Cesium.Cartesian3.fromDegrees(line.startPoint[0], line.startPoint[1], line.startPoint[2]),
              Cesium.Cartesian3.fromDegrees(line.endPoint[0], line.endPoint[1], line.endPoint[2]),
            ],
            width: 5.0,
            material: new Cesium.PolylineGlowMaterialProperty({
              glowPower: 0.35,
              color: isPassB
                ? Cesium.Color.fromCssColorString('#10B981')
                : Cesium.Color.fromCssColorString('#38BDF8'),
            }),
          },
        });
        droneFlightLinesEntitiesRef.current.push(lineEntity);
      });
    }

    // 2.2 Transit Polyline from Home to Waypoint 1 and from last Waypoint back to Home/Landing
    if (droneHomePoint && droneWaypoints && droneWaypoints.length > 0) {
      const homeCartesian = Cesium.Cartesian3.fromDegrees(
        droneHomePoint[0],
        droneHomePoint[1],
        droneTargetAltitudeM || 80
      );
      const firstWpCartesian = Cesium.Cartesian3.fromDegrees(
        droneWaypoints[0].longitude,
        droneWaypoints[0].latitude,
        droneWaypoints[0].altitudeMeters || droneTargetAltitudeM || 80
      );
      const lastWpCartesian = Cesium.Cartesian3.fromDegrees(
        droneWaypoints[droneWaypoints.length - 1].longitude,
        droneWaypoints[droneWaypoints.length - 1].latitude,
        droneWaypoints[droneWaypoints.length - 1].altitudeMeters || droneTargetAltitudeM || 80
      );
      const returnCartesian = droneLandingPoint
        ? Cesium.Cartesian3.fromDegrees(droneLandingPoint[0], droneLandingPoint[1], droneTargetAltitudeM || 80)
        : homeCartesian;

      droneTransitEntityRef.current = viewer.entities.add({
        polyline: {
          positions: [homeCartesian, firstWpCartesian],
          width: 2.5,
          material: new Cesium.PolylineDashMaterialProperty({
            color: Cesium.Color.fromCssColorString('#F59E0B'),
            dashLength: 12.0,
          }),
        },
      });

      const returnEntity = viewer.entities.add({
        polyline: {
          positions: [lastWpCartesian, returnCartesian],
          width: 2.5,
          material: new Cesium.PolylineDashMaterialProperty({
            color: Cesium.Color.fromCssColorString('#F43F5E'),
            dashLength: 12.0,
          }),
        },
      });
      droneMarkerEntitiesRef.current.push(returnEntity);
    }

    // 3. Render Photo Capture Trigger Points Along All Flight Lines
    if (dronePhotoPositions && dronePhotoPositions.length > 0) {
      dronePhotoPositions.forEach((photo) => {
        const photoEntity = viewer.entities.add({
          position: Cesium.Cartesian3.fromDegrees(photo.longitude, photo.latitude, photo.altitudeMeters),
          point: {
            pixelSize: 8,
            color: Cesium.Color.fromCssColorString('#F59E0B'),
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 1.5,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          label: {
            text: `📷 #${photo.sequence}`,
            font: '9px Kanit, sans-serif',
            fillColor: Cesium.Color.WHITE,
            backgroundColor: Cesium.Color.fromCssColorString('#0F172A').withAlpha(0.85),
            showBackground: true,
            horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -9),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 2500),
          },
        });
        dronePhotoEntitiesRef.current.push(photoEntity);
      });
    }

    // 4. Render Waypoint Numbered Markers at key turning/photo waypoints
    if (droneWaypoints && droneWaypoints.length > 0) {
      droneWaypoints.forEach((wp, idx) => {
        const isSelected = selectedDroneWaypointIndex === idx;
        const isKeyWaypoint = idx === 0 || idx === droneWaypoints.length - 1 || idx % 2 === 0;
        if (!isKeyWaypoint && !isSelected && droneWaypoints.length > 30) return;

        const wpEntity = viewer.entities.add({
          position: Cesium.Cartesian3.fromDegrees(
            wp.longitude,
            wp.latitude,
            wp.altitudeMeters || droneTargetAltitudeM || 80
          ),
          point: {
            pixelSize: isSelected ? 16 : 10,
            color: isSelected
              ? Cesium.Color.fromCssColorString('#F43F5E')
              : idx === 0
              ? Cesium.Color.fromCssColorString('#10B981')
              : idx === droneWaypoints.length - 1
              ? Cesium.Color.fromCssColorString('#F59E0B')
              : Cesium.Color.fromCssColorString('#06B6D4'),
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: isSelected ? 3 : 2,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          label: {
            text: `#${wp.sequence || idx + 1}`,
            font: 'bold 11px "Inter", "Sarabun", sans-serif',
            fillColor: Cesium.Color.WHITE,
            backgroundColor: isSelected
              ? Cesium.Color.fromCssColorString('#E11D48').withAlpha(0.9)
              : Cesium.Color.fromCssColorString('#080F20').withAlpha(0.85),
            showBackground: true,
            horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -12),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        });
        droneWaypointEntitiesRef.current.push(wpEntity);
      });
    }
  }, [
    droneWaypoints,
    droneFlightLines,
    dronePhotoPositions,
    droneSampleFootprints,
    droneHomePoint,
    droneTakeoffPoint,
    droneTargetAltitudeM,
    selectedDroneWaypointIndex,
  ]);

  // Drone Interactive Click & Draw Handler
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !droneInteractionMode || droneInteractionMode === 'none') return;

    const clickHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    clickHandler.setInputAction((movement: any) => {
      let cartesian: Cesium.Cartesian3 | undefined;
      if (viewer.scene.pickPositionSupported) {
        cartesian = viewer.scene.pickPosition(movement.position);
      }
      if (!cartesian) {
        cartesian = viewer.camera.pickEllipsoid(movement.position, viewer.scene.globe.ellipsoid);
      }
      if (!cartesian) return;

      const carto = Cesium.Cartographic.fromCartesian(cartesian);
      const lon = Number(Cesium.Math.toDegrees(carto.longitude).toFixed(6));
      const lat = Number(Cesium.Math.toDegrees(carto.latitude).toFixed(6));

      if (droneInteractionMode === 'draw_polygon') {
        setDroneDrawingPoints((prev) => {
          const next = [...prev, [lon, lat] as [number, number]];
          if (droneTempDrawEntityRef.current) viewer.entities.remove(droneTempDrawEntityRef.current);
          if (next.length >= 2) {
            droneTempDrawEntityRef.current = viewer.entities.add({
              polyline: {
                positions: next.map(([ln, lt]) => Cesium.Cartesian3.fromDegrees(ln, lt, 0)),
                width: 2.5,
                material: Cesium.Color.YELLOW,
                clampToGround: true,
              },
            });
          }
          return next;
        });
      } else if (droneInteractionMode === 'set_home' && onDroneHomePointChange) {
        onDroneHomePointChange([lon, lat, droneTargetAltitudeM || 80]);
      } else if (droneInteractionMode === 'set_takeoff' && onDroneTakeoffPointChange) {
        onDroneTakeoffPointChange([lon, lat, droneTargetAltitudeM || 80]);
      } else if (droneInteractionMode === 'set_landing' && onDroneLandingPointChange) {
        onDroneLandingPointChange([lon, lat, droneTargetAltitudeM || 80]);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    clickHandler.setInputAction(() => {
      if (droneInteractionMode === 'draw_polygon' && droneDrawingPoints.length >= 3 && onDronePolygonChange) {
        onDronePolygonChange(droneDrawingPoints);
        setDroneDrawingPoints([]);
        if (droneTempDrawEntityRef.current) {
          viewer.entities.remove(droneTempDrawEntityRef.current);
          droneTempDrawEntityRef.current = null;
        }
      }
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);

    return () => {
      clickHandler.destroy();
    };
  }, [
    droneInteractionMode,
    droneDrawingPoints,
    onDronePolygonChange,
    onDroneHomePointChange,
    onDroneTakeoffPointChange,
    onDroneLandingPointChange,
    droneTargetAltitudeM,
  ]);

  return (
    <div
      className={`relative w-full h-full overflow-hidden select-none bg-navy-950 ${
        measureMode !== 'none' || droneInteractionMode !== 'none' ? 'cursor-crosshair' : 'cursor-default'
      }`}
    >
      {/* Drone Drawing Floating Banner */}
      {droneInteractionMode === 'draw_polygon' && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-slate-900/90 border border-cyan-500/50 rounded-2xl px-4 py-2.5 shadow-2xl backdrop-blur-md flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
          <div className="text-xs font-semibold text-slate-200">
            คลิกบนแผนที่เพื่อเพิ่มจุดยอดขอบเขตบิน (ปัจจุบัน: {droneDrawingPoints.length} จุด) • คลิกขวาเพื่อเสร็จสิ้น
          </div>
          {droneDrawingPoints.length >= 3 && (
            <button
              onClick={() => {
                if (onDronePolygonChange) onDronePolygonChange(droneDrawingPoints);
                setDroneDrawingPoints([]);
                if (droneTempDrawEntityRef.current && viewerRef.current) {
                  viewerRef.current.entities.remove(droneTempDrawEntityRef.current);
                  droneTempDrawEntityRef.current = null;
                }
              }}
              className="px-3 py-1 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg text-xs transition-colors flex items-center gap-1 cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>เสร็จสิ้นรูปปิด</span>
            </button>
          )}
        </div>
      )}

      {droneInteractionMode === 'set_home' && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-slate-900/90 border border-emerald-500/50 rounded-2xl px-4 py-2 shadow-2xl backdrop-blur-md flex items-center gap-2 text-xs font-semibold text-emerald-300">
          <Home className="w-4 h-4 text-emerald-400" />
          <span>คลิกบนแผนที่เพื่อกำหนดจุดขึ้นบิน (Home Point)</span>
        </div>
      )}
      {/* Cesium Viewer Canvas */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Top Right: Google Earth Pro Navigation Gimbal & GIS Toolbars */}
      <div
        className="absolute top-4 right-4 z-20 flex flex-col items-end gap-3"
        role="toolbar"
        aria-label="ระบบควบคุมแผนที่และเข็มทิศ 3D แบบ Google Earth Pro"
      >
        {/* Google Earth Pro Navigation Gimbal Widget */}
        <GoogleEarthCompass
          heading={coords.heading}
          pitch={coords.pitch}
          onResetNorth={handleResetNorth}
          onResetNadir={handleResetNadir}
          onPan={handlePan}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onRotateHeading={handleRotateHeading}
        />

        {/* Floating GIS Tools Strip (Mode & Measurement) */}
        <div className="bg-[#101A2D]/95 border border-[rgba(148,163,184,0.25)] rounded-2xl p-1.5 flex items-center gap-1.5 shadow-2xl backdrop-blur-md">
          {/* GPS Detect Location Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              locateUserDevice(true);
            }}
            title={
              userGps
                ? `พิกัด GPS คอมพิวเตอร์: ${userGps.lat.toFixed(5)}, ${userGps.lon.toFixed(5)} (คลิกเพื่อบินไปยังตำแหน่ง)`
                : 'ตรวจจับพิกัด GPS ของคอมพิวเตอร์เครื่องนี้ (Locate My Device)'
            }
            aria-label="ตรวจจับตำแหน่ง GPS ของเครื่องคอมพิวเตอร์"
            className={`w-12 h-12 min-w-[48px] min-h-[48px] flex flex-col items-center justify-center rounded-xl transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-[#22D3EE] focus-visible:outline-none ${
              isLocatingGps
                ? 'bg-[#06B6D4]/30 text-[#06B6D4] animate-pulse'
                : userGps
                ? 'text-[#06B6D4] bg-[#06B6D4]/15 border border-[#06B6D4]/30'
                : 'text-[#CBD5E1] hover:text-[#22D3EE] hover:bg-[#162238]'
            }`}
          >
            <LocateFixed className={`w-5 h-5 ${isLocatingGps ? 'animate-spin text-[#06B6D4]' : ''}`} />
            <span className="text-[9px] text-[#94A3B8] font-medium mt-0.5">GPS</span>
          </button>

          <div className="w-px h-7 bg-[rgba(148,163,184,0.20)]" />

          {/* 2D / 3D Mode Toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleToggleSceneMode();
            }}
            title={`สลับมุมมอง (ปัจจุบัน: ${sceneMode}) — คลิกเพื่อสลับเป็น ${sceneMode === '3D' ? '2D แบนราบ' : '3D มิติสมจริง'}`}
            aria-label={`สลับมุมมอง 2D หรือ 3D ปัจจุบันคือ ${sceneMode}`}
            className="w-12 h-12 min-w-[48px] min-h-[48px] flex flex-col items-center justify-center text-[#CBD5E1] hover:text-[#22D3EE] hover:bg-[#162238] rounded-xl transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-[#22D3EE] focus-visible:outline-none"
          >
            <span className="text-[11px] font-bold font-mono text-[#06B6D4]">{sceneMode}</span>
            <span className="text-[9px] text-[#94A3B8]">โหมด</span>
          </button>

          <div className="w-px h-7 bg-[rgba(148,163,184,0.20)]" />

          {/* Measure Geodesic Distance */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (measureMode === 'distance') {
                clearMeasurements();
              } else {
                clearMeasurements();
                setMeasureMode('distance');
              }
            }}
            title="วัดระยะทางตามความโค้งผิวโลก (Geodesic Distance) — คลิกจุดบนแผนที่"
            aria-label="วัดระยะทาง"
            aria-pressed={measureMode === 'distance'}
            className={`w-12 h-12 min-w-[48px] min-h-[48px] flex items-center justify-center rounded-xl transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-[#22D3EE] focus-visible:outline-none ${
              measureMode === 'distance'
                ? 'bg-[#06B6D4] text-[#080F20] font-bold shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                : 'text-[#CBD5E1] hover:text-[#22D3EE] hover:bg-[#162238]'
            }`}
          >
            <Ruler className="w-5 h-5" />
          </button>

          {/* Measure Spherical Polygon Area */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (measureMode === 'area') {
                clearMeasurements();
              } else {
                clearMeasurements();
                setMeasureMode('area');
              }
            }}
            title="วัดพื้นที่รูปหลายเหลี่ยมตามทรงรี WGS84 (Spherical Area) — คลิกหลายจุดเพื่อคำนวณ"
            aria-label="วัดพื้นที่รูปหลายเหลี่ยม"
            aria-pressed={measureMode === 'area'}
            className={`w-12 h-12 min-w-[48px] min-h-[48px] flex items-center justify-center rounded-xl transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-[#22D3EE] focus-visible:outline-none ${
              measureMode === 'area'
                ? 'bg-[#06B6D4] text-[#080F20] font-bold shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                : 'text-[#CBD5E1] hover:text-[#22D3EE] hover:bg-[#162238]'
            }`}
          >
            <Shapes className="w-5 h-5" />
          </button>

          {/* Clear Measurements */}
          {measureMode !== 'none' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                clearMeasurements();
              }}
              title="ล้างข้อมูลการวัดค่าทั้งหมด"
              aria-label="ล้างข้อมูลการวัดค่าทั้งหมด"
              className="w-12 h-12 min-w-[48px] min-h-[48px] flex items-center justify-center text-[#F43F5E] hover:bg-[#F43F5E]/20 rounded-xl transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-[#F43F5E]"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Measurement Active Result Tooltip */}
      {measurementResult && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-20 bg-[#101A2D]/95 border border-[#06B6D4]/60 rounded-2xl px-6 py-3 text-xs font-mono shadow-2xl backdrop-blur-md flex flex-col gap-1 items-center animate-in fade-in duration-200">
          <div className="flex items-center gap-2 text-[#22D3EE] font-bold text-sm">
            <Crosshair className="w-4 h-4 text-[#06B6D4] animate-spin" />
            <span>{measurementResult.primary}</span>
          </div>
          {measurementResult.secondary && (
            <div className="text-[11px] text-[#94A3B8]">{measurementResult.secondary}</div>
          )}
        </div>
      )}

      {/* Change Detection Legend (Bottom Right) */}
      <ChangeLegend visibleLayers={visibleLayers} onToggleLayer={handleToggleLayer} />

      {/* Real-time Coordinate, Ground Elevation & Spatial Attributes Display (Bottom Left) */}
      <div
        className="absolute bottom-4 left-4 z-20 bg-[#101A2D]/95 border border-[rgba(148,163,184,0.25)] rounded-2xl px-4 py-2.5 text-xs font-mono text-[#CBD5E1] flex items-center gap-4 shadow-2xl backdrop-blur-md select-none"
        role="status"
        aria-label="สถานะพิกัดและความสูงภูมิประเทศปัจจุบัน"
      >
        <div className="flex items-center gap-1.5">
          <span className="text-[#06B6D4] font-bold">LAT:</span>
          <span className="text-[#F1F5F9]">{coords.lat.toFixed(5)}° N</span>
        </div>
        <div className="w-px h-4 bg-[rgba(148,163,184,0.20)]" />
        <div className="flex items-center gap-1.5">
          <span className="text-[#06B6D4] font-bold">LON:</span>
          <span className="text-[#F1F5F9]">{coords.lon.toFixed(5)}° E</span>
        </div>
        <div className="w-px h-4 bg-[rgba(148,163,184,0.20)]" />
        <div className="flex items-center gap-1.5">
          <span className="text-[#10B981] font-bold" title="ระดับความสูงพื้นผิวภูมิประเทศ (Ground Surface Elevation)">
            TERRAIN:
          </span>
          <span className="text-[#F1F5F9]">{coords.groundElevation} ม. (MSL)</span>
        </div>
        <div className="w-px h-4 bg-[rgba(148,163,184,0.20)]" />
        <div className="flex items-center gap-1.5 hidden md:flex">
          <span className="text-[#94A3B8]" title="ระดับความสูงกล้อง (Eye Altitude)">
            EYE:
          </span>
          <span className="text-[#F1F5F9]">{coords.cameraHeight.toLocaleString()} ม.</span>
        </div>
        <div className="w-px h-4 bg-[rgba(148,163,184,0.20)] hidden sm:block" />
        <div className="flex items-center gap-1.5 hidden sm:flex">
          <span className="text-[#94A3B8]">BEARING:</span>
          <span className="text-[#06B6D4] font-bold">
            {toSignedBearing(coords.heading) >= 0 ? `+${Math.round(toSignedBearing(coords.heading))}` : Math.round(toSignedBearing(coords.heading))}°
          </span>
          <span className="text-[#64748B] text-[10px]">({Math.round(((coords.heading % 360) + 360) % 360)}°)</span>
        </div>
        <div className="w-px h-4 bg-[rgba(148,163,184,0.20)] hidden md:block" />
        <div className="flex items-center gap-1.5 hidden md:flex">
          <span className="text-[#94A3B8]">CRS:</span>
          <span className="text-[#10B981] font-bold">EPSG:4326 / UTM 47N</span>
        </div>
      </div>
    </div>
  );
}
