'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as Cesium from 'cesium';
import {
  Compass,
  Maximize2,
  Ruler,
  ZoomIn,
  ZoomOut,
  Crosshair,
  Shapes,
  Trash2,
  Eye,
  EyeOff,
  Navigation,
  Activity,
  Layers,
  MapPin,
  LocateFixed,
} from 'lucide-react';
import {
  TeamDTO,
  TeamLocationDTO,
  MapLayerDTO,
  SimulatedPositionDTO,
  PlacedMapFeatureDTO,
  SymbolCatalogDTO,
  FeatureStyle,
  toSignedBearing,
  MAP_BEARING,
  DEFAULT_MAP_CENTER,
  computeBoundingBox,
  calculate2DGroundAltitude,
  getInitial2DCameraTarget,
} from '@geomonitor/shared';
import { DrawingTool } from './DrawingToolbar';
import { getSymbolSvgDataUrl } from './SymbolIcon';
import { calculateGeodesicDistance, generateGeodesicCircle } from '@/lib/gis-engine';
import { getDeviceLocation } from '@/lib/geolocation';
import GoogleEarthCompass from '../map/GoogleEarthCompass';

if (typeof window !== 'undefined') {
  (window as any).CESIUM_BASE_URL = '/cesium';
}

interface OperationsMapProps {
  teams?: TeamDTO[];
  locations?: TeamLocationDTO[];
  layers?: MapLayerDTO[];
  placedFeatures?: PlacedMapFeatureDTO[];
  selectedItem?: { type: 'team' | 'location' | 'simulation'; id: string } | null;
  onSelectItem?: (item: { type: 'team' | 'location' | 'simulation'; id: string } | null) => void;
  selectedFeatureId?: string | null;
  onSelectFeature?: (feature: PlacedMapFeatureDTO | null) => void;
  activeTool?: DrawingTool;
  selectedSymbol?: SymbolCatalogDTO | null;
  drawingVertices?: [number, number][];
  onVertexAdded?: (coord: [number, number]) => void;
  onFinishFeatureDrawing?: (geometry: any, featureType: string, style?: FeatureStyle) => void;
  onCancelFeatureDrawing?: () => void;
  simulatedPositions?: SimulatedPositionDTO[];
  currentSimTime?: string | null;
  mapMode2D?: boolean;
  flyToCoords?: { longitude: number; latitude: number; altitude?: number } | null;
}

export default function OperationsMap({
  teams = [],
  locations = [],
  layers = [],
  placedFeatures = [],
  selectedItem,
  onSelectItem,
  selectedFeatureId,
  onSelectFeature,
  activeTool = 'none',
  selectedSymbol = null,
  drawingVertices = [],
  onVertexAdded,
  onFinishFeatureDrawing,
  onCancelFeatureDrawing,
  simulatedPositions = [],
  currentSimTime,
  mapMode2D = true,
  flyToCoords = null,
}: OperationsMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);

  // Entities tracking
  const teamEntitiesRef = useRef<Map<string, Cesium.Entity>>(new Map());
  const locationEntitiesRef = useRef<Map<string, Cesium.Entity>>(new Map());
  const featureEntitiesRef = useRef<Map<string, Cesium.Entity>>(new Map());
  const simEntitiesRef = useRef<Map<string, Cesium.Entity>>(new Map());
  const trailEntityRef = useRef<Cesium.Entity | null>(null);

  // Drawing preview entities
  const tempDrawEntityRef = useRef<Cesium.Entity | null>(null);
  const tempVerticesEntitiesRef = useRef<Cesium.Entity[]>([]);

  // Coordinate display HUD
  // User Device GPS Tracking State
  const [userGps, setUserGps] = useState<{ lon: number; lat: number; accuracy: number } | null>(null);
  const userGpsEntityRef = useRef<Cesium.Entity | null>(null);
  const userGpsCircleEntityRef = useRef<Cesium.Entity | null>(null);

  // Master Contract Section 3: Initial Map Bearing = -90° (270° in Cesium 0-360 range)
  const initialMapBearing = -90;
  const initialMapBearingRad = Cesium.Math.toRadians(270);

  const [coords, setCoords] = useState<{
    lat: number;
    lon: number;
    height: number;
    heading: number;
    pitch: number;
  }>({
    lat: 13.7563,
    lon: 100.5018,
    height: 5000,
    heading: initialMapBearing,
    pitch: -45,
  });

  // Safe coordinate extraction helper
  const pickCoordinates = useCallback(
    (position: Cesium.Cartesian2): { lon: number; lat: number } | null => {
      const viewer = viewerRef.current;
      if (!viewer || viewer.isDestroyed()) return null;

      let cartesian: Cesium.Cartesian3 | undefined;
      // Try scene.pickPosition first for terrain/3D models
      if (viewer.scene.pickPositionSupported) {
        cartesian = viewer.scene.pickPosition(position);
      }
      // Fallback to ellipsoid if outside terrain or pickPosition failed
      if (!cartesian) {
        cartesian = viewer.camera.pickEllipsoid(position, viewer.scene.globe.ellipsoid);
      }
      if (!cartesian) return null;

      const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
      const lon = Number(Cesium.Math.toDegrees(cartographic.longitude).toFixed(6));
      const lat = Number(Cesium.Math.toDegrees(cartographic.latitude).toFixed(6));

      if (isNaN(lon) || isNaN(lat) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        return null;
      }
      return { lon, lat };
    },
    []
  );

  // 1. Initialize Cesium Viewer
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
        timeline: false,
        baseLayerPicker: false,
        baseLayer: false,
        fullscreenButton: false,
        geocoder: false,
        homeButton: false,
        infoBox: false,
        sceneModePicker: false,
        selectionIndicator: false,
        navigationHelpButton: false,
        scene3DOnly: false,
        terrainProvider: new Cesium.EllipsoidTerrainProvider(),
        sceneMode: mapMode2D ? Cesium.SceneMode.SCENE2D : Cesium.SceneMode.SCENE3D,
      });

      viewer.scene.globe.enableLighting = false;
      viewer.scene.globe.depthTestAgainstTerrain = true;
      viewer.scene.screenSpaceCameraController.maximumZoomDistance = 5000000;
      viewer.scene.screenSpaceCameraController.minimumZoomDistance = 10;

      // 3. Base Imagery: High resolution Esri satellite with error handling (Same as primary GIS map)
      const baseImagery = new Cesium.UrlTemplateImageryProvider({
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        maximumLevel: 19,
        credit: new Cesium.Credit('Esri World Imagery'),
      });

      baseImagery.errorEvent.addEventListener((error: any) => {
        console.warn('[Cesium Operations BaseImagery Warning] Tile request error:', error?.message || error);
      });

      viewer.imageryLayers.removeAll();
      viewer.imageryLayers.addImageryProvider(baseImagery);

      // Remove default double-click camera action so it does not conflict with polygon completion
      viewer.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

      viewerRef.current = viewer;
      if (typeof window !== 'undefined') {
        (window as any).__cesiumViewer = viewer;
      }

      // Mouse Move Tracking for HUD
      const mouseHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      mouseHandler.setInputAction((movement: any) => {
        const pt = pickCoordinates(movement.endPosition);
        if (pt) {
          const headingDeg = Cesium.defined(viewer.camera.heading)
            ? Math.round(viewer.camera.heading * (180 / Math.PI))
            : initialMapBearing;
          const pitchDeg = Cesium.defined(viewer.camera.pitch)
            ? Math.round(viewer.camera.pitch * (180 / Math.PI))
            : -90;

          setCoords({
            lat: pt.lat,
            lon: pt.lon,
            height: viewer.camera.positionCartographic ? Math.round(viewer.camera.positionCartographic.height) : 1000,
            heading: headingDeg,
            pitch: pitchDeg,
          });
        }
      }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

      // Deterministic 2D-First Camera Initialization (Phase 3)
      const initialTarget = getInitial2DCameraTarget({
        defaultCenter: DEFAULT_MAP_CENTER,
      });

      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(
          initialTarget.longitude,
          initialTarget.latitude,
          initialTarget.height
        ),
        orientation: {
          heading: initialMapBearingRad,
          pitch: Cesium.Math.toRadians(-89.9), // Strict 2D nadir
          roll: 0.0,
        },
      });

      // Synchronize HUD coordinates immediately to initial target view
      setCoords({
        lat: Number(initialTarget.latitude.toFixed(5)),
        lon: Number(initialTarget.longitude.toFixed(5)),
        height: Math.round(initialTarget.height),
        heading: Math.round(initialMapBearingRad * (180 / Math.PI)),
        pitch: -90,
      });

      // Camera movement listener for continuous HUD synchronization
      const removeCameraListener = viewer.camera.changed.addEventListener(() => {
        if (!viewer || viewer.isDestroyed()) return;
        const carto = viewer.camera.positionCartographic;
        if (!carto) return;

        const headingDeg = Cesium.defined(viewer.camera.heading)
          ? Math.round(viewer.camera.heading * (180 / Math.PI))
          : initialMapBearing;
        const pitchDeg = Cesium.defined(viewer.camera.pitch)
          ? Math.round(viewer.camera.pitch * (180 / Math.PI))
          : -90;

        setCoords((prev) => ({
          ...prev,
          lat: Cesium.defined(carto.latitude) ? Number((carto.latitude * (180 / Math.PI)).toFixed(5)) : prev.lat,
          lon: Cesium.defined(carto.longitude) ? Number((carto.longitude * (180 / Math.PI)).toFixed(5)) : prev.lon,
          height: Cesium.defined(carto.height) ? Math.round(carto.height) : prev.height,
          heading: headingDeg,
          pitch: pitchDeg,
        }));
      });

      // Passive GPS Detection in background without moving/overwriting camera
      getDeviceLocation()
        .then((loc) => {
          const lon = Number(loc.longitude.toFixed(6));
          const lat = Number(loc.latitude.toFixed(6));
          const accuracy = Math.round(loc.accuracy || 15);
          setUserGps({ lon, lat, accuracy });
          // Camera remains locked to target area in 2D nadir view.
        })
        .catch(() => {
          // Passive notice
        });

      return () => {
        removeCameraListener();
        mouseHandler.destroy();
        if (viewerRef.current && !viewerRef.current.isDestroyed()) {
          viewerRef.current.destroy();
          viewerRef.current = null;
        }
      };
    } catch (e) {
      console.error('[Cesium Init Error]', e);
    }
  }, []);

  // 2. Toggle 2D / 3D Mode with position preservation
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    const carto = viewer.camera.positionCartographic;
    const currentLon = (carto && Math.abs(carto.longitude) > 0.001) ? (carto.longitude * 180 / Math.PI) : coords.lon;
    const currentLat = (carto && Math.abs(carto.latitude) > 0.001) ? (carto.latitude * 180 / Math.PI) : coords.lat;
    const currentHeight = (carto && carto.height < 50000) ? carto.height : (coords.height || 2100);

    if (mapMode2D) {
      const onMorphTo2DComplete = () => {
        viewer.scene.morphComplete.removeEventListener(onMorphTo2DComplete);
        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(currentLon, currentLat, currentHeight),
          orientation: {
            heading: initialMapBearingRad,
            pitch: Cesium.Math.toRadians(-89.9),
            roll: 0,
          },
        });
      };
      viewer.scene.morphComplete.addEventListener(onMorphTo2DComplete);
      viewer.scene.morphTo2D(1.0);
    } else {
      const onMorphTo3DComplete = () => {
        viewer.scene.morphComplete.removeEventListener(onMorphTo3DComplete);
        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(currentLon, currentLat, Math.min(Math.max(currentHeight, 500), 5000)),
          orientation: {
            heading: initialMapBearingRad,
            pitch: Cesium.Math.toRadians(-45),
            roll: 0,
          },
        });
      };
      viewer.scene.morphComplete.addEventListener(onMorphTo3DComplete);
      viewer.scene.morphTo3D(1.0);
    }
  }, [mapMode2D, coords.lon, coords.lat, coords.height, initialMapBearingRad]);

  // 2.1 Smooth Camera Fly-To when flyToCoords changes
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed() || !flyToCoords) return;

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        flyToCoords.longitude,
        flyToCoords.latitude,
        flyToCoords.altitude || 1200
      ),
      orientation: {
        heading: viewer.camera.heading,
        pitch: Cesium.Math.toRadians(-50),
        roll: 0.0,
      },
      duration: 1.2,
    });
  }, [flyToCoords]);

  // 3. Render Placed Features from Layers (Symbols & Vector Shapes)
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    // Clear old features
    featureEntitiesRef.current.forEach((entity) => viewer.entities.remove(entity));
    featureEntitiesRef.current.clear();

    const layerMap = new Map(layers.map((l) => [l.id, l]));

    placedFeatures.forEach((feat) => {
      const layer = layerMap.get(feat.layerId);
      // Respect layer visibility
      if (layer && !layer.visibility) return;

      const layerOpacity = layer?.opacity !== undefined ? layer.opacity : 1.0;
      const style = feat.style || {};
      const isSelected = selectedFeatureId === feat.id;

      // Color calculations
      const rawColor = style.color || style.strokeColor || style.fillColor || layer?.colorHex || '#00f0ff';
      const baseCesiumColor = Cesium.Color.fromCssColorString(rawColor);
      const featureOpacity = (style.opacity !== undefined ? style.opacity : 1.0) * layerOpacity;

      // AltitudeMode & Ground Clamping interpretation (Requirement 10.4)
      const altMode = feat.properties?.altitudeMode || 'clampToGround';
      const altitudeVal = typeof feat.properties?.altitude === 'number'
        ? feat.properties.altitude
        : (feat.geometry?.coordinates && typeof feat.geometry.coordinates[2] === 'number' ? feat.geometry.coordinates[2] : 0);
      const isElevated = (altMode === 'relativeToGround' || altMode === 'absolute') && altitudeVal > 0;

      if (feat.featureType === 'Point' && feat.geometry?.coordinates) {
        const [lon, lat] = feat.geometry.coordinates;
        const ptSize = style.size || 24;

        const entity = viewer.entities.add({
          id: `feature-${feat.id}`,
          name: feat.name || 'สัญลักษณ์แผนที่',
          position: Cesium.Cartesian3.fromDegrees(lon, lat, isElevated ? altitudeVal : 15),
          point: {
            pixelSize: isSelected ? ptSize + 6 : ptSize,
            color: baseCesiumColor.withAlpha(featureOpacity),
            outlineColor: isSelected ? Cesium.Color.WHITE : Cesium.Color.BLACK,
            outlineWidth: isSelected ? 3 : 1.5,
            heightReference: isElevated ? Cesium.HeightReference.NONE : Cesium.HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          label:
            style.showLabel !== false && (style.labelText || feat.name)
              ? {
                text: ` ${style.labelText || feat.name} `,
                font: `${style.labelSize || 12}px sans-serif`,
                fillColor: Cesium.Color.WHITE,
                backgroundColor: Cesium.Color.fromCssColorString('#020617').withAlpha(0.85),
                showBackground: true,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                heightReference: isElevated ? Cesium.HeightReference.NONE : Cesium.HeightReference.CLAMP_TO_GROUND,
                disableDepthTestDistance: 25000,
                pixelOffset: new Cesium.Cartesian2(0, -(ptSize / 2 + 6)),
              }
              : undefined,
        });

        // Store custom data on entity
        (entity as any)._geomonitorFeature = feat;
        featureEntitiesRef.current.set(feat.id, entity);
      } else if (
        feat.featureType === 'LineString' &&
        feat.geometry?.coordinates
      ) {
        const coords = feat.geometry.coordinates;
        const positions = isElevated
          ? coords.map((c: number[]) => Cesium.Cartesian3.fromDegrees(c[0], c[1], c[2] ?? altitudeVal))
          : coords.map(([lon, lat]: [number, number]) => Cesium.Cartesian3.fromDegrees(lon, lat, 0));

        const entity = viewer.entities.add({
          id: `feature-${feat.id}`,
          name: feat.name || 'เส้นทาง',
          polyline: {
            positions,
            width: isSelected ? (style.strokeWidth || 3) + 2 : style.strokeWidth || 3,
            material: isSelected
              ? Cesium.Color.WHITE
              : baseCesiumColor.withAlpha(featureOpacity),
            clampToGround: !isElevated,
          },
        });
        (entity as any)._geomonitorFeature = feat;
        featureEntitiesRef.current.set(feat.id, entity);
      } else if (feat.featureType === 'Polygon' && feat.geometry?.coordinates) {
        const coords = feat.geometry.coordinates[0];
        if (coords && coords.length >= 3) {
          const flatPositions = coords.flatMap(([lon, lat]: [number, number]) => [lon, lat]);
          const fillAlpha = (style.fillOpacity !== undefined ? style.fillOpacity : 0.3) * featureOpacity;

          const closedBoundaryPositions = isElevated
            ? coords.map((c: number[]) => Cesium.Cartesian3.fromDegrees(c[0], c[1], c[2] ?? altitudeVal))
            : coords.map(([lon, lat]: [number, number]) => Cesium.Cartesian3.fromDegrees(lon, lat, 0));
          if (closedBoundaryPositions.length > 0) {
            const first = coords[0];
            closedBoundaryPositions.push(
              Cesium.Cartesian3.fromDegrees(first[0], first[1], isElevated ? (first[2] ?? altitudeVal) : 0)
            );
          }

          const entity = viewer.entities.add({
            id: `feature-${feat.id}`,
            name: feat.name || 'พื้นที่',
            polygon: {
              hierarchy: Cesium.Cartesian3.fromDegreesArray(flatPositions),
              material: baseCesiumColor.withAlpha(fillAlpha),
              classificationType: isElevated ? undefined : Cesium.ClassificationType.TERRAIN,
              height: isElevated ? altitudeVal : undefined,
            },
            polyline: {
              positions: closedBoundaryPositions,
              width: isSelected ? 3.5 : style.strokeWidth || 2,
              material: isSelected ? Cesium.Color.WHITE : baseCesiumColor.withAlpha(featureOpacity),
              clampToGround: !isElevated,
            },
            label:
              style.showLabel !== false && (style.labelText || feat.name)
                ? {
                  text: ` ${style.labelText || feat.name} `,
                  font: `${style.labelSize || 12}px sans-serif`,
                  fillColor: Cesium.Color.WHITE,
                  backgroundColor: Cesium.Color.fromCssColorString('#020617').withAlpha(0.85),
                  showBackground: true,
                  heightReference: isElevated ? Cesium.HeightReference.NONE : Cesium.HeightReference.CLAMP_TO_GROUND,
                  disableDepthTestDistance: 25000,
                }
                : undefined,
          });
          (entity as any)._geomonitorFeature = feat;
          featureEntitiesRef.current.set(feat.id, entity);
        }
      } else if (feat.featureType === 'MultiPolygon' && feat.geometry?.coordinates) {
        const fillAlpha = (style.fillOpacity !== undefined ? style.fillOpacity : 0.3) * featureOpacity;
        (feat.geometry.coordinates as any[]).forEach((polyPart: any, pIdx: number) => {
          const coords = polyPart[0];
          if (!coords || coords.length < 3) return;
          const flatPositions = coords.flatMap((pt: number[]) => [pt[0], pt[1]]);
          const closedBoundaryPositions = coords.map((pt: number[]) =>
            Cesium.Cartesian3.fromDegrees(pt[0], pt[1], isElevated ? altitudeVal : 0)
          );
          closedBoundaryPositions.push(
            Cesium.Cartesian3.fromDegrees(coords[0][0], coords[0][1], isElevated ? altitudeVal : 0)
          );

          const entity = viewer.entities.add({
            id: `feature-${feat.id}-part-${pIdx}`,
            name: `${feat.name || 'พื้นที่'} (ส่วนที่ ${pIdx + 1})`,
            polygon: {
              hierarchy: Cesium.Cartesian3.fromDegreesArray(flatPositions),
              material: baseCesiumColor.withAlpha(fillAlpha),
              classificationType: isElevated ? undefined : Cesium.ClassificationType.TERRAIN,
              height: isElevated ? altitudeVal : undefined,
            },
            polyline: {
              positions: closedBoundaryPositions,
              width: isSelected ? 3.5 : style.strokeWidth || 2,
              material: isSelected ? Cesium.Color.WHITE : baseCesiumColor.withAlpha(featureOpacity),
              clampToGround: !isElevated,
            },
          });
          (entity as any)._geomonitorFeature = feat;
        });
      }
    });
  }, [placedFeatures, layers, selectedFeatureId]);

  // 4. Render Teams Positions
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    teamEntitiesRef.current.forEach((entity) => viewer.entities.remove(entity));
    teamEntitiesRef.current.clear();

    teams.forEach((team) => {
      if (!team.latestLocation) return;
      const { longitude, latitude, freshness } = team.latestLocation;

      let pinColor = Cesium.Color.fromCssColorString('#10b981');
      if (freshness === 'stale') pinColor = Cesium.Color.fromCssColorString('#f59e0b');
      if (freshness === 'unavailable') pinColor = Cesium.Color.fromCssColorString('#64748b');

      const isSelected = selectedItem?.type === 'team' && selectedItem.id === team.id;

      const entity = viewer.entities.add({
        id: `team-${team.id}`,
        name: team.name,
        position: Cesium.Cartesian3.fromDegrees(longitude, latitude, 20),
        point: {
          pixelSize: isSelected ? 16 : 12,
          color: pinColor,
          outlineColor: isSelected ? Cesium.Color.CYAN : Cesium.Color.BLACK,
          outlineWidth: isSelected ? 3 : 2,
        },
        label: {
          text: ` ${team.identifier} `,
          font: 'bold 11px sans-serif',
          fillColor: Cesium.Color.WHITE,
          backgroundColor: Cesium.Color.fromCssColorString('#0f172a').withAlpha(0.85),
          showBackground: true,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -12),
        },
      });

      teamEntitiesRef.current.set(team.id, entity);
    });
  }, [teams, selectedItem]);

  // 5. Render Team Locations (Bases, Checkpoints)
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    locationEntitiesRef.current.forEach((entity) => viewer.entities.remove(entity));
    locationEntitiesRef.current.clear();

    locations.forEach((loc) => {
      if (!loc.geometry) return;
      const isSelected = selectedItem?.type === 'location' && selectedItem.id === loc.id;

      if (loc.geometry.type === 'Point') {
        const [lng, lat] = loc.geometry.coordinates;
        let iconColor = Cesium.Color.fromCssColorString('#0284c7');
        if (loc.locationType === 'incident_site') iconColor = Cesium.Color.fromCssColorString('#ef4444');
        if (loc.locationType === 'checkpoint') iconColor = Cesium.Color.fromCssColorString('#eab308');

        const entity = viewer.entities.add({
          id: `loc-${loc.id}`,
          name: loc.name,
          position: Cesium.Cartesian3.fromDegrees(lng, lat, 10),
          point: {
            pixelSize: isSelected ? 18 : 14,
            color: iconColor,
            outlineColor: isSelected ? Cesium.Color.WHITE : Cesium.Color.NAVY,
            outlineWidth: 2,
          },
          label: {
            text: ` ${loc.name} `,
            font: '10px sans-serif',
            fillColor: Cesium.Color.WHITE,
            backgroundColor: Cesium.Color.fromCssColorString('#0284c7').withAlpha(0.8),
            showBackground: true,
            verticalOrigin: Cesium.VerticalOrigin.TOP,
            pixelOffset: new Cesium.Cartesian2(0, 10),
          },
        });
        locationEntitiesRef.current.set(loc.id, entity);
      }
    });
  }, [locations, selectedItem]);

  // 6. Interactive Click & Drawing ScreenSpaceEventHandler
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    // LEFT CLICK HANDLER
    handler.setInputAction((movement: any) => {
      // If we are in drawing or placement mode
      if (activeTool !== 'none') {
        const pt = pickCoordinates(movement.position);
        if (!pt) return;

        if (activeTool === 'symbol' && selectedSymbol) {
          // Direct placement for selected catalog symbol
          const geometry = {
            type: 'Point',
            coordinates: [pt.lon, pt.lat],
          };
          const style: FeatureStyle = {
            color: selectedSymbol.defaultColor || '#00f0ff',
            size: selectedSymbol.defaultSize || 24,
            rotation: selectedSymbol.defaultRotation || 0,
            opacity: 1.0,
            visible: true,
            labelText: selectedSymbol.name,
            showLabel: true,
            labelSize: 12,
          };
          if (onFinishFeatureDrawing) {
            onFinishFeatureDrawing(geometry, 'Point', style);
          }
          return;
        }

        if (activeTool === 'point') {
          const geometry = {
            type: 'Point',
            coordinates: [pt.lon, pt.lat],
          };
          if (onFinishFeatureDrawing) {
            onFinishFeatureDrawing(geometry, 'Point');
          }
          return;
        }

        if (activeTool === 'text') {
          const text = prompt('กรอกข้อความกำกับแผนที่:', 'จุดสังเกตการณ์');
          if (text) {
            const geometry = {
              type: 'Point',
              coordinates: [pt.lon, pt.lat],
            };
            const style: FeatureStyle = {
              color: '#ffffff',
              labelText: text,
              showLabel: true,
              labelSize: 14,
            };
            if (onFinishFeatureDrawing) {
              onFinishFeatureDrawing(geometry, 'Point', style);
            }
          }
          return;
        }

        if (activeTool === 'rectangle') {
          if (drawingVertices.length === 0) {
            if (onVertexAdded) onVertexAdded([pt.lon, pt.lat]);
          } else {
            // Second corner completes rectangle
            const [lon1, lat1] = drawingVertices[0];
            const lon2 = pt.lon;
            const lat2 = pt.lat;
            const minLon = Math.min(lon1, lon2);
            const maxLon = Math.max(lon1, lon2);
            const minLat = Math.min(lat1, lat2);
            const maxLat = Math.max(lat1, lat2);

            const polygonCoords = [
              [
                [minLon, minLat],
                [maxLon, minLat],
                [maxLon, maxLat],
                [minLon, maxLat],
                [minLon, minLat],
              ],
            ];
            const geometry = { type: 'Polygon', coordinates: polygonCoords };
            if (onFinishFeatureDrawing) {
              onFinishFeatureDrawing(geometry, 'Polygon');
            }
          }
          return;
        }

        if (activeTool === 'circle') {
          if (drawingVertices.length === 0) {
            if (onVertexAdded) onVertexAdded([pt.lon, pt.lat]);
          } else {
            // Second point defines radius -> calculate true geodesic circle on WGS84
            const [cLon, cLat] = drawingVertices[0];
            const radiusMeters = calculateGeodesicDistance(cLon, cLat, pt.lon, pt.lat);
            const circleCoords = generateGeodesicCircle(cLon, cLat, radiusMeters, 48);

            const geometry = { type: 'Polygon', coordinates: [circleCoords] };
            if (onFinishFeatureDrawing) {
              onFinishFeatureDrawing(geometry, 'Polygon');
            }
          }
          return;
        }

        if (activeTool === 'polyline' || activeTool === 'polygon') {
          if (onVertexAdded) {
            onVertexAdded([pt.lon, pt.lat]);
          }
          return;
        }
      }

      // If NOT drawing, handle object selection
      const pickedObject = viewer.scene.pick(movement.position);
      if (Cesium.defined(pickedObject) && pickedObject.id) {
        const entity = pickedObject.id;

        // Check if placed feature
        if (entity._geomonitorFeature && onSelectFeature) {
          onSelectFeature(entity._geomonitorFeature);
          return;
        }

        // Check if team
        if (entity.id && entity.id.startsWith('team-') && onSelectItem) {
          onSelectItem({ type: 'team', id: entity.id.replace('team-', '') });
          return;
        }

        // Check if location
        if (entity.id && entity.id.startsWith('loc-') && onSelectItem) {
          onSelectItem({ type: 'location', id: entity.id.replace('loc-', '') });
          return;
        }
      } else {
        // Deselect if empty space clicked
        if (onSelectFeature) onSelectFeature(null);
        if (onSelectItem) onSelectItem(null);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // DOUBLE CLICK HANDLER (Finish Polyline / Polygon)
    handler.setInputAction(() => {
      if (activeTool === 'polyline' && drawingVertices.length >= 2) {
        const geometry = {
          type: 'LineString',
          coordinates: drawingVertices,
        };
        if (onFinishFeatureDrawing) onFinishFeatureDrawing(geometry, 'LineString');
      } else if (activeTool === 'polygon' && drawingVertices.length >= 3) {
        const closed = [...drawingVertices, drawingVertices[0]];
        const geometry = {
          type: 'Polygon',
          coordinates: [closed],
        };
        if (onFinishFeatureDrawing) onFinishFeatureDrawing(geometry, 'Polygon');
      }
    }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

    return () => {
      handler.destroy();
    };
  }, [
    activeTool,
    selectedSymbol,
    drawingVertices,
    pickCoordinates,
    onVertexAdded,
    onFinishFeatureDrawing,
    onSelectFeature,
    onSelectItem,
  ]);

  // 7. Render Active Drawing Temporary Preview
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    // Clean previous preview
    if (tempDrawEntityRef.current) {
      viewer.entities.remove(tempDrawEntityRef.current);
      tempDrawEntityRef.current = null;
    }
    tempVerticesEntitiesRef.current.forEach((e) => viewer.entities.remove(e));
    tempVerticesEntitiesRef.current = [];

    if (drawingVertices.length === 0) return;

    // Render vertex handles clamped to ground
    drawingVertices.forEach(([lon, lat], idx) => {
      const handle = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(lon, lat, 0),
        point: {
          pixelSize: 8,
          color: Cesium.Color.YELLOW,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
      tempVerticesEntitiesRef.current.push(handle);
    });

    // Render connecting polyline for in-progress drawing draped on terrain
    if (drawingVertices.length >= 2) {
      const positions = drawingVertices.map(([lon, lat]) =>
        Cesium.Cartesian3.fromDegrees(lon, lat, 0)
      );

      tempDrawEntityRef.current = viewer.entities.add({
        polyline: {
          positions,
          width: 3,
          material: new Cesium.PolylineDashMaterialProperty({
            color: Cesium.Color.YELLOW,
            dashLength: 12.0,
          }),
          clampToGround: true,
        },
      });
    }
  }, [drawingVertices]);

  // 8. Fly to Selected Item
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed() || !selectedItem) return;

    if (selectedItem.type === 'team') {
      const team = teams.find((t) => t.id === selectedItem.id);
      if (team?.latestLocation) {
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(
            team.latestLocation.longitude,
            team.latestLocation.latitude,
            1200
          ),
          duration: 1.5,
        });
      }
    } else if (selectedItem.type === 'location') {
      const loc = locations.find((l) => l.id === selectedItem.id);
      if (loc?.geometry?.type === 'Point') {
        const [lng, lat] = loc.geometry.coordinates;
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(lng, lat, 1000),
          duration: 1.5,
        });
      }
    }
  }, [selectedItem, teams, locations]);

  // Google Earth Pro Navigation Handlers
  const handleResetNorth = useCallback(() => {
    const v = viewerRef.current;
    if (!v || v.isDestroyed()) return;
    v.camera.flyTo({
      destination: v.camera.position,
      orientation: { heading: initialMapBearingRad, pitch: v.camera.pitch, roll: 0 },
      duration: 0.8,
    });
  }, [initialMapBearingRad]);

  const handleResetNadir = useCallback(() => {
    const v = viewerRef.current;
    if (!v || v.isDestroyed()) return;
    v.camera.flyTo({
      destination: v.camera.position,
      orientation: { heading: v.camera.heading, pitch: Cesium.Math.toRadians(-89.9), roll: 0 },
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
      orientation: { heading: newHeading, pitch: v.camera.pitch, roll: 0 },
    });
  }, []);

  // Global Keyboard Navigation (Google Earth Pro shortcuts)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

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
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleResetNorth, handleResetNadir, handlePan, handleZoomIn, handleZoomOut]);

  // Render User Device GPS Location Marker on 3D Globe
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

    // Device Marker Point and Label
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

  return (
    <div
      className={`relative w-full h-full overflow-hidden select-none bg-navy-950 ${activeTool !== 'none' ? 'cursor-crosshair' : 'cursor-default'
        }`}
    >
      {/* Cesium Canvas Container */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Top Floating Google Earth Pro Compass Gimbal */}
      <div className="absolute top-4 right-4 z-20 flex flex-col items-end gap-2">
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

        {/* Floating Tools Strip: Locate GPS */}
        <div className="bg-card/95 border border-border rounded-2xl p-1.5 flex items-center shadow-2xl backdrop-blur-md text-foreground">
          <button
            onClick={async () => {
              if (viewerRef.current) {
                try {
                  const loc = await getDeviceLocation();
                  const lon = Number(loc.longitude.toFixed(6));
                  const lat = Number(loc.latitude.toFixed(6));
                  const accuracy = Math.round(loc.accuracy || 15);
                  setUserGps({ lon, lat, accuracy });
                  viewerRef.current?.camera.flyTo({
                    destination: Cesium.Cartesian3.fromDegrees(lon, lat, 2000),
                    orientation: { heading: initialMapBearingRad, pitch: Cesium.Math.toRadians(-45), roll: 0 },
                    duration: 1.5,
                  });
                } catch {
                  // Fallback
                }
              }
            }}
            title={userGps ? `GPS คอมพิวเตอร์: ${userGps.lat.toFixed(5)}, ${userGps.lon.toFixed(5)}` : 'ตรวจจับพิกัด GPS คอมพิวเตอร์'}
            aria-label="ตรวจจับพิกัด GPS คอมพิวเตอร์"
            className="w-10 h-10 flex flex-col items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-all cursor-pointer"
          >
            <LocateFixed className="w-5 h-5 text-primary" />
          </button>
        </div>
      </div>

      {/* Coordinate & Altitude HUD (Bottom Left) */}
      <div className="absolute bottom-6 left-4 z-20 bg-card/95 border border-border rounded-2xl px-4 py-2.5 text-xs font-mono text-foreground shadow-2xl backdrop-blur-md flex items-center gap-4 select-none">
        <div className="flex items-center gap-1.5">
          <span className="text-primary font-bold">LAT:</span>
          <span className="text-foreground">{coords.lat.toFixed(5)}°N</span>
        </div>
        <div className="w-px h-4 bg-border" />
        <div className="flex items-center gap-1.5">
          <span className="text-primary font-bold">LON:</span>
          <span className="text-foreground">{coords.lon.toFixed(5)}°E</span>
        </div>
        <div className="w-px h-4 bg-border" />
        <div className="flex items-center gap-1.5">
          <span className="text-success font-bold">EYE:</span>
          <span className="text-foreground">{coords.height.toLocaleString()} ม.</span>
        </div>
        <div className="w-px h-4 bg-border" />
        <div className="flex items-center gap-1.5 hidden sm:flex">
          <span className="text-muted-foreground">BEARING:</span>
          <span className="text-primary font-bold">
            {toSignedBearing(coords.heading) >= 0 ? `+${Math.round(toSignedBearing(coords.heading))}` : Math.round(toSignedBearing(coords.heading))}°
          </span>
          <span className="text-muted-foreground/80 text-[10px]">({Math.round(((coords.heading % 360) + 360) % 360)}°)</span>
        </div>
        <div className="w-px h-4 bg-border" />
        <div className="flex items-center gap-1.5 hidden md:flex">
          <span className="text-muted-foreground">CRS:</span>
          <span className="text-success font-bold">EPSG:4326 / UTM 47N</span>
        </div>
        {activeTool !== 'none' && (
          <div className="px-2.5 py-1 rounded-xl bg-primary/10 text-primary text-xs font-semibold flex items-center gap-1.5 border border-primary/30">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            โหมดวาด: {activeTool.toUpperCase()}
          </div>
        )}
      </div>
    </div>
  );
}
