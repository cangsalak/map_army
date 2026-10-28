/**
 * Symbol Library & Drawing Tools Types
 */

export type SymbolCategory =
  | 'general_locations'
  | 'offices_facilities'
  | 'people_teams'
  | 'vehicles_equipment'
  | 'medical_emergency'
  | 'infrastructure'
  | 'environmental_monitoring'
  | 'drone_survey'
  | 'general_graphics'
  | 'custom_symbols';

export const SYMBOL_CATEGORIES: SymbolCategory[] = [
  'general_locations',
  'offices_facilities',
  'people_teams',
  'vehicles_equipment',
  'medical_emergency',
  'infrastructure',
  'environmental_monitoring',
  'drone_survey',
  'general_graphics',
  'custom_symbols',
];

export const SYMBOL_CATEGORY_LABELS: Record<SymbolCategory, string> = {
  general_locations: 'General Locations (ตำแหน่งทั่วไป)',
  offices_facilities: 'Offices and Facilities (กองบัญชาการและอาคาร)',
  people_teams: 'People and Teams (กำลังพลและชุดปฏิบัติการ)',
  vehicles_equipment: 'Vehicles and Equipment (ยานพาหนะและยุทโธปกรณ์)',
  medical_emergency: 'Medical and Emergency Services (หน่วยแพทย์และกู้ชีพ)',
  infrastructure: 'Infrastructure (โครงสร้างพื้นฐาน)',
  environmental_monitoring: 'Environmental Monitoring (เฝ้าระวังสิ่งแวดล้อม)',
  drone_survey: 'Drone Survey Locations (จุดสำรวจและขึ้นบินโดรน)',
  general_graphics: 'General Map Graphics (รูปทรงกราฟิกแผนที่)',
  custom_symbols: 'Custom Symbols (สัญลักษณ์กำหนดเอง)',
};

export interface SymbolCatalogDTO {
  id: string;
  name: string;
  description: string | null;
  category: SymbolCategory;
  iconKey: string;
  defaultColor: string;
  defaultSize: number;
  defaultRotation: number;
  tags: string[];
  assetPath: string | null;
  svgContent?: string | null;
  isCustom: boolean;
  isFavorite?: boolean;
  createdAt: string;
}

export interface FeatureStyle {
  color?: string;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  opacity?: number;
  fillOpacity?: number;
  visible?: boolean;
  size?: number;
  rotation?: number;
  iconKey?: string;
  svgContent?: string | null;
  labelText?: string;
  showLabel?: boolean;
  labelSize?: number;
  labelColor?: string;
  dashPattern?: number[];
}

export interface PlacedMapFeatureDTO {
  id: string;
  projectId: string;
  layerId: string;
  layerName?: string;
  symbolId?: string | null;
  symbol?: SymbolCatalogDTO | null;
  featureType:
    | 'Point'
    | 'LineString'
    | 'Polygon'
    | 'MultiPoint'
    | 'MultiLineString'
    | 'MultiPolygon'
    | 'Circle'
    | 'Rectangle'
    | 'Text';
  name: string;
  description: string | null;
  geometry: any; // GeoJSON geometry (Point, LineString, Polygon)
  style: FeatureStyle;
  properties: Record<string, any>;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LayerReorderItem {
  id: string;
  orderIndex: number;
}
