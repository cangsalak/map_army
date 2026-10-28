/**
 * OGC KML 2.2 and KMZ Import/Export Types & Specifications
 */

export type KmlAltitudeMode = 'clampToGround' | 'relativeToGround' | 'absolute';

export type KmlImportIntent =
  | 'view_only'              // แสดงบนแผนที่เท่านั้น
  | 'responsibility_area'    // นำเข้าเป็นพื้นที่รับผิดชอบ (Managed Area)
  | 'mission_area'           // นำเข้าเป็น Mission Area (สำหรับ Drone Mission Planner)
  | 'reference_gis';         // นำเข้าเป็นข้อมูลอ้างอิง (GIS Reference)

export interface KmlStyleProperties {
  strokeColor?: string;
  strokeWidth?: number;
  strokeOpacity?: number;
  fillColor?: string;
  fillOpacity?: number;
  iconUrl?: string;
  iconScale?: number;
  iconColor?: string;
}

export interface KmlFeatureProperties {
  id?: string;
  name: string;
  description?: string;
  altitudeMode: KmlAltitudeMode;
  altitude?: number;
  folderName?: string;
  extendedData?: Record<string, string | number | boolean>;
  style?: KmlStyleProperties;
  rawKmlSnippet?: string;
  sourceFile?: string;
  [key: string]: any;
}

export interface KmlFeature {
  type: 'Feature';
  id?: string;
  geometry: {
    type: 'Point' | 'LineString' | 'LinearRing' | 'Polygon' | 'MultiPoint' | 'MultiLineString' | 'MultiPolygon' | 'GeometryCollection';
    coordinates: any;
  };
  properties: KmlFeatureProperties;
}

export interface KmlFeatureCollection {
  type: 'FeatureCollection';
  name?: string;
  description?: string;
  features: KmlFeature[];
  metadata?: {
    originalFilename: string;
    fileFormat: 'kml' | 'kmz';
    fileSizeBytes: number;
    crs: string;
    altitudeReference: string;
    featureCount: number;
    geometrySummary: {
      points: number;
      lines: number;
      polygons: number;
      multiGeometries: number;
    };
    hasGroundOverlay?: boolean;
    folders: string[];
    warnings: string[];
  };
}

export interface KmlParseResult {
  success: boolean;
  featureCollection?: KmlFeatureCollection;
  errors?: string[];
  warnings?: string[];
}

export interface KmlImportPayload {
  projectId: string;
  layerName: string;
  originalFilename: string;
  fileFormat: 'kml' | 'kmz';
  intent: KmlImportIntent;
  featureCollection: KmlFeatureCollection;
  selectedPolygonIndex?: number;
  colorHex?: string;
}
