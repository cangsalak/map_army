'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Navbar from '@/components/layout/Navbar';
import OperationsSidebar from '@/components/operations/OperationsSidebar';
import LocationInspector from '@/components/operations/LocationInspector';
import SimulationTimeline from '@/components/operations/SimulationTimeline';
import CreateTeamModal from '@/components/operations/CreateTeamModal';
import CreateLocationModal from '@/components/operations/CreateLocationModal';
import CreateLayerModal from '@/components/operations/CreateLayerModal';
import SymbolLibraryModal from '@/components/operations/SymbolLibraryModal';
import DrawingToolbar, { DrawingTool } from '@/components/operations/DrawingToolbar';
import FeatureEditorPanel from '@/components/operations/FeatureEditorPanel';
import ImportGeoJsonModal from '@/components/operations/ImportGeoJsonModal';
import ImportKmlModal from '@/components/operations/ImportKmlModal';
import { apiFetch } from '@/lib/api';
import {
  TeamDTO,
  TeamLocationDTO,
  MapLayerDTO,
  SimulationSessionDTO,
  SimulatedPositionDTO,
  PlacedMapFeatureDTO,
  SymbolCatalogDTO,
  FeatureStyle,
} from '@geomonitor/shared';
import {
  Layers,
  MapPin,
  Users,
  Compass,
  Download,
  Upload,
  Globe,
  Grid,
  Maximize2,
  Navigation,
  RefreshCw,
  FolderKanban,
  Sparkles,
} from 'lucide-react';

// Dynamic import for CesiumMap to avoid SSR window error
const OperationsMap = dynamic(
  () => import('@/components/operations/OperationsMap'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-navy-950 text-cyan-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-mono tracking-wider">กำลังโหลดแผนที่ปฏิบัติการ 3 มิติ (CesiumJS)...</span>
        </div>
      </div>
    ),
  }
);

export default function OperationsMapPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  const [teams, setTeams] = useState<TeamDTO[]>([]);
  const [locations, setLocations] = useState<TeamLocationDTO[]>([]);
  const [layers, setLayers] = useState<MapLayerDTO[]>([]);
  const [activeLayerId, setActiveLayerId] = useState<string>('');
  const [placedFeatures, setPlacedFeatures] = useState<PlacedMapFeatureDTO[]>([]);

  const [simulationSessions, setSimulationSessions] = useState<SimulationSessionDTO[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [simTrackpoints, setSimTrackpoints] = useState<SimulatedPositionDTO[]>([]);
  const [currentSimTime, setCurrentSimTime] = useState<string | null>(null);

  // Inspector & Editor selection
  const [selectedItem, setSelectedItem] = useState<{
    type: 'team' | 'location' | 'simulation';
    id: string;
  } | null>(null);

  const [selectedFeature, setSelectedFeature] = useState<PlacedMapFeatureDTO | null>(null);

  // Drawing & Symbol Placement State
  const [activeTool, setActiveTool] = useState<DrawingTool>('none');
  const [selectedSymbol, setSelectedSymbol] = useState<SymbolCatalogDTO | null>(null);
  const [drawingVertices, setDrawingVertices] = useState<[number, number][]>([]);
  const [undoStack, setUndoStack] = useState<[number, number][][]>([]);
  const [redoStack, setRedoStack] = useState<[number, number][][]>([]);

  const [mapMode2D, setMapMode2D] = useState(false);
  const [flyToCoords, setFlyToCoords] = useState<{ longitude: number; latitude: number; altitude?: number } | null>(null);

  // Modals state
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isLayerModalOpen, setIsLayerModalOpen] = useState(false);
  const [isSymbolLibraryOpen, setIsSymbolLibraryOpen] = useState(false);
  const [importLayerId, setImportLayerId] = useState<string | null>(null);
  const [isKmlModalOpen, setIsKmlModalOpen] = useState(false);

  // Active layer info
  const activeLayer = useMemo(
    () => layers.find((l) => l.id === activeLayerId) || layers[0],
    [layers, activeLayerId]
  );

  // 1. Load Projects
  useEffect(() => {
    async function loadProjects() {
      try {
        const res = await apiFetch<any[]>('/projects');
        const items = Array.isArray(res) ? res : [];
        setProjects(items);
        if (items.length > 0 && !selectedProjectId) {
          setSelectedProjectId(items[0].id);
        }
      } catch (err) {
        console.error('Failed to load projects', err);
      }
    }
    loadProjects();
  }, []);

  // 2. Load Features for All Layers in Project
  const loadLayerFeatures = useCallback(async (currentLayers: MapLayerDTO[]) => {
    try {
      const allFeatures: PlacedMapFeatureDTO[] = [];
      for (const layer of currentLayers) {
        const res = await apiFetch<any>(`/layers/${layer.id}/features`);
        if (res && res.features && Array.isArray(res.features)) {
          const list: PlacedMapFeatureDTO[] = res.features.map((f: any) => ({
            id: f.id,
            projectId: f.properties?.projectId || layer.projectId,
            layerId: layer.id,
            symbolId: f.properties?.symbolId,
            featureType: f.geometry?.type || f.properties?.featureType || 'Point',
            name: f.properties?.name || f.properties?.title,
            description: f.properties?.description,
            geometry: f.geometry,
            style: f.properties?.style || {},
            properties: f.properties || {},
            symbol: f.properties?.symbol,
            createdAt: f.properties?.createdAt,
            updatedAt: f.properties?.updatedAt,
          }));
          allFeatures.push(...list);
        }
      }
      setPlacedFeatures(allFeatures);
    } catch (err) {
      console.error('Failed to load layer features', err);
    }
  }, []);

  // 3. Load Teams, Locations, Layers & Simulations for selected project
  const loadProjectData = useCallback(async () => {
    if (!selectedProjectId) return;

    try {
      // Teams
      const teamsRes = await apiFetch<TeamDTO[]>(`/teams?projectId=${selectedProjectId}`);
      setTeams(Array.isArray(teamsRes) ? teamsRes : []);

      // Locations
      const locRes = await apiFetch<TeamLocationDTO[]>(`/locations?projectId=${selectedProjectId}`);
      setLocations(Array.isArray(locRes) ? locRes : []);

      // Layers
      const layersRes = await apiFetch<MapLayerDTO[]>(`/layers?projectId=${selectedProjectId}`);
      const layersList = Array.isArray(layersRes) ? layersRes : [];
      setLayers(layersList);

      if (layersList.length > 0 && (!activeLayerId || !layersList.some((l) => l.id === activeLayerId))) {
        setActiveLayerId(layersList[0].id);
      }

      // Load features
      loadLayerFeatures(layersList);

      // Simulations
      const simRes = await apiFetch<SimulationSessionDTO[]>(`/simulations?projectId=${selectedProjectId}`);
      const simItems = Array.isArray(simRes) ? simRes : [];
      setSimulationSessions(simItems);
      if (simItems.length > 0 && !selectedSessionId) {
        setSelectedSessionId(simItems[0].id);
      }
    } catch (err) {
      console.error('Failed to load project operations data', err);
    }
  }, [selectedProjectId, activeLayerId, loadLayerFeatures]);

  useEffect(() => {
    loadProjectData();
  }, [loadProjectData]);

  // 4. Load Simulation Trackpoints when Session is selected
  useEffect(() => {
    if (!selectedSessionId) {
      setSimTrackpoints([]);
      return;
    }

    async function loadTimeline() {
      try {
        const res = await apiFetch<{ sessionId: string; trackpoints: SimulatedPositionDTO[] }>(
          `/simulations/${selectedSessionId}/timeline`
        );
        setSimTrackpoints(res?.trackpoints || []);
      } catch (err) {
        console.error('Failed to load simulation timeline', err);
      }
    }
    loadTimeline();
  }, [selectedSessionId]);

  // Keyboard shortcut (Escape to cancel drawing or deselect)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeTool !== 'none') {
          setActiveTool('none');
          setSelectedSymbol(null);
          setDrawingVertices([]);
          setUndoStack([]);
          setRedoStack([]);
        } else if (selectedFeature) {
          setSelectedFeature(null);
        } else if (selectedItem) {
          setSelectedItem(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTool, selectedFeature, selectedItem]);

  // Layer handlers
  const handleToggleLayerVisibility = async (layerId: string, current: boolean) => {
    try {
      await apiFetch(`/layers/${layerId}`, {
        method: 'PATCH',
        body: JSON.stringify({ visibility: !current }),
      });
      setLayers((prev) =>
        prev.map((l) => (l.id === layerId ? { ...l, visibility: !current } : l))
      );
    } catch (err) {
      console.error('Failed to toggle layer', err);
    }
  };

  const handleChangeLayerOpacity = async (layerId: string, opacity: number) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === layerId ? { ...l, opacity } : l))
    );
    try {
      await apiFetch(`/layers/${layerId}`, {
        method: 'PATCH',
        body: JSON.stringify({ opacity }),
      });
    } catch (err) {
      console.error('Failed to update layer opacity', err);
    }
  };

  // Drawing Vertex Management (Undo / Redo)
  const handleVertexAdded = (coord: [number, number]) => {
    setUndoStack((prev) => [...prev, drawingVertices]);
    setRedoStack([]);
    setDrawingVertices((prev) => [...prev, coord]);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setRedoStack((prev) => [...prev, drawingVertices]);
    setUndoStack((prev) => prev.slice(0, -1));
    setDrawingVertices(previous);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((prev) => [...prev, drawingVertices]);
    setRedoStack((prev) => prev.slice(0, -1));
    setDrawingVertices(next);
  };

  // Finish Drawing Feature & Save to Active Layer
  const handleFinishDrawing = async (
    geometry?: any,
    featureTypeOverride?: string,
    customStyle?: FeatureStyle
  ) => {
    const targetLayer = activeLayer;
    if (!targetLayer) {
      alert('กรุณาเลือกหรือสร้างชั้นข้อมูลก่อนวาด');
      return;
    }
    if (!targetLayer.isEditable) {
      alert('ชั้นข้อมูลปัจจุบันเป็นแบบอ่านอย่างเดียว ไม่อนุญาตให้บันทึก');
      return;
    }

    let geom = geometry;
    let featType = featureTypeOverride;

    if (!geom) {
      if (activeTool === 'polyline' && drawingVertices.length >= 2) {
        geom = { type: 'LineString', coordinates: drawingVertices };
        featType = 'LineString';
      } else if (activeTool === 'polygon' && drawingVertices.length >= 3) {
        const closed = [...drawingVertices, drawingVertices[0]];
        geom = { type: 'Polygon', coordinates: [closed] };
        featType = 'Polygon';
      } else {
        return;
      }
    }

    try {
      const defaultName =
        selectedSymbol?.name ||
        (featType === 'Point'
          ? 'จุดสัญลักษณ์ใหม่'
          : featType === 'LineString'
          ? 'เส้นทางใหม่'
          : 'ขอบเขตพื้นที่ใหม่');

      const stylePayload: FeatureStyle = customStyle || {
        color: selectedSymbol?.defaultColor || targetLayer.colorHex || '#00f0ff',
        fillColor: selectedSymbol?.defaultColor || targetLayer.colorHex || '#00f0ff',
        strokeColor: selectedSymbol?.defaultColor || targetLayer.colorHex || '#00f0ff',
        size: selectedSymbol?.defaultSize || 24,
        rotation: selectedSymbol?.defaultRotation || 0,
        opacity: 1.0,
        visible: true,
        labelText: defaultName,
        showLabel: true,
        labelSize: 12,
        strokeWidth: 2,
        fillOpacity: 0.3,
      };

      const payload = {
        layerId: targetLayer.id,
        projectId: selectedProjectId,
        symbolId: selectedSymbol ? selectedSymbol.id : undefined,
        featureType: featType || 'Point',
        name: defaultName,
        description: selectedSymbol?.description || undefined,
        geometry: geom,
        style: stylePayload,
        properties: {
          category: selectedSymbol?.category || 'General',
        },
      };

      const res = await apiFetch<any>(`/layers/${targetLayer.id}/features`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      // Clear drawing state
      setActiveTool('none');
      setSelectedSymbol(null);
      setDrawingVertices([]);
      setUndoStack([]);
      setRedoStack([]);

      // Refresh features and layer list
      loadProjectData();
    } catch (err: any) {
      alert(err.message || 'ไม่สามารถบันทึกวัตถุแผนที่ได้');
    }
  };

  const handleCancelDrawing = () => {
    setActiveTool('none');
    setSelectedSymbol(null);
    setDrawingVertices([]);
    setUndoStack([]);
    setRedoStack([]);
  };

  // Export Layer to GeoJSON file
  const handleExportGeoJson = async (layerId: string, layerName: string) => {
    try {
      const res = await apiFetch<any>(`/layers/${layerId}/features`);
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(res, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `${layerName.replace(/\s+/g, '_')}_export.geojson`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err) {
      console.error('Failed to export GeoJSON', err);
    }
  };

  // Export Layer to OGC KML 2.2 file
  const handleExportKml = (layerId: string, layerName: string) => {
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', `/api/v1/layers/${layerId}/export-kml`);
    downloadAnchor.setAttribute('download', `${layerName.replace(/\s+/g, '_')}.kml`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Export Layer to Compressed KMZ file
  const handleExportKmz = (layerId: string, layerName: string) => {
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', `/api/v1/layers/${layerId}/export-kmz`);
    downloadAnchor.setAttribute('download', `${layerName.replace(/\s+/g, '_')}.kmz`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Zoom to Layer
  const handleZoomToLayer = async (layerId: string) => {
    try {
      const res = await apiFetch<any>(`/layers/${layerId}/features`);
      const features = res?.data?.features || res?.features || [];
      if (features.length === 0) {
        alert('ชั้นข้อมูลนี้ยังไม่มีรูปแปลงพิกัด');
        return;
      }
      let sumLon = 0;
      let sumLat = 0;
      let count = 0;
      for (const f of features) {
        const coords = f.geometry?.coordinates;
        if (f.geometry?.type === 'Point' && coords) {
          sumLon += coords[0];
          sumLat += coords[1];
          count++;
        } else if (f.geometry?.type === 'LineString' && Array.isArray(coords)) {
          for (const c of coords) {
            sumLon += c[0];
            sumLat += c[1];
            count++;
          }
        } else if (f.geometry?.type === 'Polygon' && Array.isArray(coords?.[0])) {
          for (const c of coords[0]) {
            sumLon += c[0];
            sumLat += c[1];
            count++;
          }
        }
      }
      if (count > 0) {
        setFlyToCoords({ longitude: sumLon / count, latitude: sumLat / count });
      }
    } catch (err) {
      console.error('Failed to zoom to layer', err);
    }
  };

  // Convert polygon to managed area
  const handleConvertToManagedArea = async (layerId: string, layerName: string) => {
    if (!confirm(`คุณต้องการแปลงรูปแปลงในชั้นข้อมูล "${layerName}" เป็นพื้นที่รับผิดชอบ (Managed Area) หรือไม่?`)) return;
    try {
      const res = await apiFetch<any>(`/layers/${layerId}/convert-to-managed-area`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      alert(`แปลงเป็นพื้นที่รับผิดชอบ "${res.data?.name || layerName}" สำเร็จเรียบร้อย!`);
      loadProjectData();
    } catch (err: any) {
      alert(err.message || 'ไม่สามารถแปลงเป็นพื้นที่รับผิดชอบได้');
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-navy-950 text-slate-100 font-sans">
      {/* Global Navbar */}
      <Navbar />

      {/* Operations Sub-Toolbar */}
      <div className="h-10 bg-navy-900 border-b border-navy-800 px-4 flex items-center justify-between z-20 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-cyan-400 font-semibold">
            <FolderKanban className="w-4 h-4" />
            <span>โครงการ:</span>
          </div>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="bg-navy-950 border border-navy-700 rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-cyan-500 font-medium"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => loadProjectData()}
            className="p-1 rounded text-slate-400 hover:text-cyan-400 hover:bg-navy-800 transition-colors"
            title="รีเฟรชข้อมูลล่าสุด"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 2D / 3D Map View Toggle & Symbol Quick Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsSymbolLibraryOpen(true)}
            className="px-3 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>คลังสัญลักษณ์ (Symbol Library)</span>
          </button>

          <div className="flex items-center bg-navy-950 p-0.5 rounded border border-navy-800">
            <button
              onClick={() => setMapMode2D(false)}
              className={`px-2 py-0.5 text-[11px] font-medium rounded flex items-center gap-1 ${
                !mapMode2D
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              ลูกโลก 3D
            </button>
            <button
              onClick={() => setMapMode2D(true)}
              className={`px-2 py-0.5 text-[11px] font-medium rounded flex items-center gap-1 ${
                mapMode2D
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              แผนที่ 2D
            </button>
          </div>
        </div>
      </div>

      {/* Main Workspace Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Sidebar */}
        <OperationsSidebar
          teams={teams}
          locations={locations}
          layers={layers}
          activeLayerId={activeLayerId}
          onSelectActiveLayer={setActiveLayerId}
          selectedItem={selectedItem}
          onSelectItem={(item) => {
            setSelectedItem(item);
            setSelectedFeature(null);
          }}
          onOpenCreateTeam={() => setIsTeamModalOpen(true)}
          onOpenCreateLocation={() => setIsLocationModalOpen(true)}
          onOpenCreateLayer={() => setIsLayerModalOpen(true)}
          onToggleLayerVisibility={handleToggleLayerVisibility}
          onChangeLayerOpacity={handleChangeLayerOpacity}
          onReorderLayers={() => loadProjectData()}
          onLayerDeleted={() => loadProjectData()}
          onLayerRenamed={() => loadProjectData()}
          onLocationDeleted={() => loadProjectData()}
          onTeamDeleted={() => loadProjectData()}
          onOpenImportKml={() => setIsKmlModalOpen(true)}
          onExportKml={handleExportKml}
          onExportKmz={handleExportKmz}
          onZoomToLayer={handleZoomToLayer}
          onConvertToManagedArea={handleConvertToManagedArea}
          onExportGeoJson={handleExportGeoJson}
          onImportGeoJson={(layerId) => setImportLayerId(layerId)}
        />

        {/* Center Interactive Cesium Map Canvas */}
        <div className="flex-1 h-full relative">
          {/* Drawing Tools Strip */}
          <DrawingToolbar
            activeTool={activeTool}
            onSelectTool={(tool) => {
              setActiveTool(tool);
              if (tool !== 'symbol') setSelectedSymbol(null);
              setDrawingVertices([]);
            }}
            onOpenSymbolLibrary={() => setIsSymbolLibraryOpen(true)}
            selectedSymbolName={selectedSymbol?.name}
            vertexCount={drawingVertices.length}
            canUndo={undoStack.length > 0}
            canRedo={redoStack.length > 0}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onFinishDrawing={() => handleFinishDrawing()}
            onCancelDrawing={handleCancelDrawing}
            activeLayerName={activeLayer?.name}
            isLayerReadOnly={activeLayer ? !activeLayer.isEditable : false}
          />

          <OperationsMap
            teams={teams}
            locations={locations}
            layers={layers}
            placedFeatures={placedFeatures}
            selectedItem={selectedItem}
            onSelectItem={setSelectedItem}
            selectedFeatureId={selectedFeature?.id}
            onSelectFeature={(feat) => {
              setSelectedFeature(feat);
              if (feat) setSelectedItem(null);
            }}
            activeTool={activeTool}
            selectedSymbol={selectedSymbol}
            drawingVertices={drawingVertices}
            onVertexAdded={handleVertexAdded}
            onFinishFeatureDrawing={handleFinishDrawing}
            onCancelFeatureDrawing={handleCancelDrawing}
            simulatedPositions={simTrackpoints}
            currentSimTime={currentSimTime}
            mapMode2D={mapMode2D}
            flyToCoords={flyToCoords}
          />
        </div>

        {/* Feature / Symbol Editor Panel (Top Right Floating) */}
        {selectedFeature && (
          <FeatureEditorPanel
            feature={selectedFeature}
            layers={layers}
            onClose={() => setSelectedFeature(null)}
            onUpdated={() => loadProjectData()}
            onDeleted={() => {
              setSelectedFeature(null);
              loadProjectData();
            }}
            onDuplicated={() => loadProjectData()}
          />
        )}

        {/* Right Details Panel for Team / Location with Live Editing and FlyTo */}
        {selectedItem && (
          <LocationInspector
            selectedItem={selectedItem}
            onClose={() => setSelectedItem(null)}
            teams={teams}
            locations={locations}
            onFlyTo={(coords) => {
              setFlyToCoords({ ...coords, altitude: 1000 });
            }}
            onLocationUpdated={() => loadProjectData()}
            onLocationDeleted={() => {
              setSelectedItem(null);
              loadProjectData();
            }}
            onTeamUpdated={() => loadProjectData()}
            onTeamDeleted={() => {
              setSelectedItem(null);
              loadProjectData();
            }}
          />
        )}
      </div>

      {/* Bottom Timeline for Simulation Playback */}
      <SimulationTimeline
        sessions={simulationSessions}
        selectedSessionId={selectedSessionId}
        onSelectSession={setSelectedSessionId}
        trackpoints={simTrackpoints}
        onTimeChange={setCurrentSimTime}
      />

      {/* Modals */}
      <SymbolLibraryModal
        isOpen={isSymbolLibraryOpen}
        onClose={() => setIsSymbolLibraryOpen(false)}
        onSelectSymbol={(symbol) => {
          setSelectedSymbol(symbol);
          setActiveTool('symbol');
        }}
      />

      <CreateTeamModal
        isOpen={isTeamModalOpen}
        onClose={() => setIsTeamModalOpen(false)}
        projectId={selectedProjectId}
        onCreated={loadProjectData}
      />

      <CreateLocationModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        projectId={selectedProjectId}
        onCreated={loadProjectData}
      />

      <CreateLayerModal
        isOpen={isLayerModalOpen}
        onClose={() => setIsLayerModalOpen(false)}
        projectId={selectedProjectId}
        onCreated={loadProjectData}
      />

      {importLayerId && (
        <ImportGeoJsonModal
          isOpen={true}
          onClose={() => setImportLayerId(null)}
          layerId={importLayerId}
          layerName={layers.find((l) => l.id === importLayerId)?.name || 'ชั้นข้อมูล'}
          onImportSuccess={() => loadProjectData()}
        />
      )}

      <ImportKmlModal
        isOpen={isKmlModalOpen}
        onClose={() => setIsKmlModalOpen(false)}
        currentProjectId={selectedProjectId}
        availableProjects={projects.map((p) => ({ id: p.id, name: p.name }))}
        onImportSuccess={() => loadProjectData()}
      />
    </div>
  );
}
