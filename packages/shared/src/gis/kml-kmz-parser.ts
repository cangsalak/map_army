/**
 * OGC KML 2.2 & KMZ Safe Parser and Generator Engine
 * GeoMonitor 3D - Thai Photogrammetry & GIS Operations Center
 */

import JSZip from 'jszip';
import {
  KmlAltitudeMode,
  KmlFeature,
  KmlFeatureCollection,
  KmlParseResult,
  KmlStyleProperties,
} from '../types/kml.js';

// Limits for ZIP Bomb and Resource Exhaustion Defense
export const KMZ_LIMITS = {
  MAX_ARCHIVE_SIZE_BYTES: 35 * 1024 * 1024,      // 35 MB
  MAX_UNCOMPRESSED_SIZE_BYTES: 60 * 1024 * 1024, // 60 MB
  MAX_FILE_COUNT: 500,
  MAX_COMPRESSION_RATIO: 100,
  MAX_FEATURES_PER_FILE: 10000,
};

// ==========================================
// Safe XML & HTML Sanitization
// ==========================================

export function sanitizeHtml(input: string): string {
  if (!input) return '';
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=\s*(["']).*?\1/gi, '')
    .replace(/on\w+\s*=\s*[^>\s]+/gi, '');
}

export function detectXxe(xmlString: string): boolean {
  const upper = xmlString.toUpperCase();
  if (upper.includes('<!ENTITY') || upper.includes('SYSTEM') || upper.includes('PUBLIC')) {
    // Check if DOCTYPE contains ENTITY definition
    if (/<!DOCTYPE[^>]+<!ENTITY/i.test(xmlString) || /<!ENTITY/i.test(xmlString)) {
      return true;
    }
  }
  return false;
}

export function parseXmlDoc(xmlString: string): Document {
  if (detectXxe(xmlString)) {
    throw new Error('XXE_DETECTED: ตรวจพบ XML External Entity (XXE) หรือการอ้างอิง DTD ภายนอกซึ่งไม่ปลอดภัย');
  }

  if (typeof window !== 'undefined' && typeof window.DOMParser !== 'undefined') {
    const parser = new window.DOMParser();
    const doc = parser.parseFromString(xmlString, 'application/xml');
    const parserError = doc.getElementsByTagName('parsererror')[0];
    if (parserError) {
      throw new Error(`XML_SYNTAX_ERROR: รูปแบบ XML ไม่ถูกต้อง: ${parserError.textContent}`);
    }
    return doc;
  } else {
    // In Node.js / Vitest environment
    const { DOMParser } = require('@xmldom/xmldom');
    const errors: string[] = [];
    const parser = new DOMParser({
      onError: (level: string, msg: string) => {
        if (level === 'error' || level === 'fatalError') {
          errors.push(msg);
        }
      },
    });
    let doc: Document;
    try {
      doc = parser.parseFromString(xmlString, 'text/xml');
    } catch (e: any) {
      throw new Error(`XML_SYNTAX_ERROR: ${e.message || 'รูปแบบ XML ไม่ถูกต้อง'}`);
    }
    if (errors.length > 0) {
      throw new Error(`XML_SYNTAX_ERROR: ${errors.join(', ')}`);
    }
    return doc;
  }
}

// ==========================================
// Color Conversion (KML AABBGGRR -> CSS HEX & Opacity)
// ==========================================

export function parseKmlColor(kmlColor: string | null | undefined): { colorHex: string; opacity: number } | null {
  if (!kmlColor) return null;
  const clean = kmlColor.trim().replace(/^#/, '');
  if (clean.length !== 8 && clean.length !== 6) return null;

  if (clean.length === 8) {
    const a = parseInt(clean.substring(0, 2), 16) / 255;
    const b = clean.substring(2, 4);
    const g = clean.substring(4, 6);
    const r = clean.substring(6, 8);
    return {
      colorHex: `#${r}${g}${b}`.toLowerCase(),
      opacity: Math.max(0, Math.min(1, Math.round(a * 100) / 100)),
    };
  } else {
    const b = clean.substring(0, 2);
    const g = clean.substring(2, 4);
    const r = clean.substring(4, 6);
    return {
      colorHex: `#${r}${g}${b}`.toLowerCase(),
      opacity: 1.0,
    };
  }
}

export function toKmlColor(hex: string, opacity = 1.0): string {
  const clean = hex.replace(/^#/, '');
  let r = 'ff';
  let g = 'ff';
  let b = 'ff';
  if (clean.length === 6) {
    r = clean.substring(0, 2);
    g = clean.substring(2, 4);
    b = clean.substring(4, 6);
  } else if (clean.length === 3) {
    r = clean[0] + clean[0];
    g = clean[1] + clean[1];
    b = clean[2] + clean[2];
  }
  const alphaVal = Math.round(Math.max(0, Math.min(1, opacity)) * 255);
  const a = alphaVal.toString(16).padStart(2, '0');
  // KML order: aabbggrr
  return `${a}${b}${g}${r}`.toLowerCase();
}

// ==========================================
// Coordinate Parsing & Validation
// ==========================================

export interface ParsedCoordinate {
  lon: number;
  lat: number;
  alt?: number;
}

export function parseCoordinatesString(
  rawText: string,
  warnings: string[]
): ParsedCoordinate[] {
  const result: ParsedCoordinate[] = [];
  const tokens = rawText.trim().split(/\s+/);

  for (const token of tokens) {
    if (!token) continue;
    const parts = token.split(',');
    if (parts.length < 2) continue;

    const lon = parseFloat(parts[0]);
    const lat = parseFloat(parts[1]);
    const alt = parts.length >= 3 && parts[2] !== '' ? parseFloat(parts[2]) : undefined;

    if (isNaN(lon) || isNaN(lat)) {
      warnings.push(`พบพิกัดที่ไม่สามารถแปลงเป็นตัวเลขได้: "${token}"`);
      continue;
    }

    if (lon < -180 || lon > 180 || lat < -90 || lat > 90) {
      warnings.push(`พิกัดอยู่นอกช่วงมาตรฐาน WGS84: Lon=${lon}, Lat=${lat}`);
      continue;
    }

    result.push({
      lon,
      lat,
      alt: alt !== undefined && !isNaN(alt) ? alt : undefined,
    });
  }

  return result;
}

// ==========================================
// Styles & StyleMaps Collection
// ==========================================

function extractStyles(doc: Document): Map<string, KmlStyleProperties> {
  const stylesMap = new Map<string, KmlStyleProperties>();

  const styleNodes = doc.getElementsByTagName('Style');
  for (let i = 0; i < styleNodes.length; i++) {
    const node = styleNodes[i];
    const id = node.getAttribute('id');
    if (!id) continue;

    const styleProp: KmlStyleProperties = {};

    // LineStyle
    const lineStyle = node.getElementsByTagName('LineStyle')[0];
    if (lineStyle) {
      const colorNode = lineStyle.getElementsByTagName('color')[0];
      const parsedColor = parseKmlColor(colorNode?.textContent);
      if (parsedColor) {
        styleProp.strokeColor = parsedColor.colorHex;
        styleProp.strokeOpacity = parsedColor.opacity;
      }
      const widthNode = lineStyle.getElementsByTagName('width')[0];
      if (widthNode) {
        styleProp.strokeWidth = parseFloat(widthNode.textContent || '2') || 2;
      }
    }

    // PolyStyle
    const polyStyle = node.getElementsByTagName('PolyStyle')[0];
    if (polyStyle) {
      const colorNode = polyStyle.getElementsByTagName('color')[0];
      const parsedColor = parseKmlColor(colorNode?.textContent);
      if (parsedColor) {
        styleProp.fillColor = parsedColor.colorHex;
        styleProp.fillOpacity = parsedColor.opacity;
      }
    }

    // IconStyle
    const iconStyle = node.getElementsByTagName('IconStyle')[0];
    if (iconStyle) {
      const href = iconStyle.getElementsByTagName('href')[0]?.textContent?.trim();
      if (href) styleProp.iconUrl = href;
      const scale = iconStyle.getElementsByTagName('scale')[0]?.textContent?.trim();
      if (scale) styleProp.iconScale = parseFloat(scale) || 1.0;
      const color = iconStyle.getElementsByTagName('color')[0]?.textContent?.trim();
      const parsedIconColor = parseKmlColor(color);
      if (parsedIconColor) styleProp.iconColor = parsedIconColor.colorHex;
    }

    stylesMap.set(`#${id}`, styleProp);
    stylesMap.set(id, styleProp);
  }

  // Handle StyleMap (link normal to style)
  const styleMapNodes = doc.getElementsByTagName('StyleMap');
  for (let i = 0; i < styleMapNodes.length; i++) {
    const mapNode = styleMapNodes[i];
    const id = mapNode.getAttribute('id');
    if (!id) continue;

    const pairs = mapNode.getElementsByTagName('Pair');
    for (let p = 0; p < pairs.length; p++) {
      const key = pairs[p].getElementsByTagName('key')[0]?.textContent?.trim();
      const styleUrl = pairs[p].getElementsByTagName('styleUrl')[0]?.textContent?.trim();
      if ((key === 'normal' || !stylesMap.has(`#${id}`)) && styleUrl) {
        const referenced = stylesMap.get(styleUrl) || stylesMap.get(styleUrl.replace(/^#/, ''));
        if (referenced) {
          stylesMap.set(`#${id}`, referenced);
          stylesMap.set(id, referenced);
        }
      }
    }
  }

  return stylesMap;
}

// ==========================================
// Geometry Parsers
// ==========================================

function parseAltitudeMode(node: Element): KmlAltitudeMode {
  const altMode =
    node.getElementsByTagName('altitudeMode')[0]?.textContent?.trim() ||
    node.getElementsByTagName('gx:altitudeMode')[0]?.textContent?.trim();

  if (altMode === 'relativeToGround' || altMode === 'relativeToSeaFloor') {
    return 'relativeToGround';
  }
  if (altMode === 'absolute') {
    return 'absolute';
  }
  return 'clampToGround';
}

function parsePoint(
  node: Element,
  warnings: string[]
): { type: 'Point'; coordinates: number[]; altitude?: number } | null {
  const coordsNode = node.getElementsByTagName('coordinates')[0];
  if (!coordsNode || !coordsNode.textContent) return null;

  const parsed = parseCoordinatesString(coordsNode.textContent, warnings);
  if (parsed.length === 0) return null;

  const first = parsed[0];
  const coords: number[] = [first.lon, first.lat];
  if (first.alt !== undefined) coords.push(first.alt);

  return {
    type: 'Point',
    coordinates: coords,
    altitude: first.alt,
  };
}

function parseLineString(
  node: Element,
  warnings: string[]
): { type: 'LineString'; coordinates: number[][]; altitude?: number } | null {
  const coordsNode = node.getElementsByTagName('coordinates')[0];
  if (!coordsNode || !coordsNode.textContent) return null;

  const parsed = parseCoordinatesString(coordsNode.textContent, warnings);
  if (parsed.length < 2) {
    warnings.push(`LineString มีพิกัดน้อยกว่า 2 จุด (${parsed.length} จุด) จึงถูกปฏิเสธ`);
    return null;
  }

  const coords = parsed.map((p) => (p.alt !== undefined ? [p.lon, p.lat, p.alt] : [p.lon, p.lat]));
  return {
    type: 'LineString',
    coordinates: coords,
    altitude: parsed[0]?.alt,
  };
}

function parseLinearRing(
  node: Element,
  warnings: string[]
): number[][] | null {
  const coordsNode = node.getElementsByTagName('coordinates')[0];
  if (!coordsNode || !coordsNode.textContent) return null;

  const parsed = parseCoordinatesString(coordsNode.textContent, warnings);
  if (parsed.length < 3) {
    warnings.push('LinearRing มีพิกัดน้อยกว่า 3 จุด ไม่สามารถสร้างขอบเขตปิดได้');
    return null;
  }

  const ring = parsed.map((p) => (p.alt !== undefined ? [p.lon, p.lat, p.alt] : [p.lon, p.lat]));

  // Ensure ring is closed
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    warnings.push('ตรวจพบ LinearRing ไม่ปิดขอบเขต ระบบได้ทำการปิดขอบเขตให้โดยอัตโนมัติ');
    ring.push([...first]);
  }

  if (ring.length < 4) {
    warnings.push('LinearRing หลังปิดขอบเขตมีจำนวนพิกัดน้อยกว่า 4 จุด');
    return null;
  }

  return ring;
}

function parsePolygon(
  node: Element,
  warnings: string[]
): { type: 'Polygon'; coordinates: number[][][]; altitude?: number } | null {
  const outerNode = node.getElementsByTagName('outerBoundaryIs')[0];
  if (!outerNode) {
    warnings.push('พบ Polygon ที่ไม่มี outerBoundaryIs');
    return null;
  }

  const outerRingNode = outerNode.getElementsByTagName('LinearRing')[0];
  if (!outerRingNode) return null;

  const outerRing = parseLinearRing(outerRingNode, warnings);
  if (!outerRing) return null;

  const rings: number[][][] = [outerRing];

  // Inner rings (holes)
  const innerNodes = node.getElementsByTagName('innerBoundaryIs');
  for (let i = 0; i < innerNodes.length; i++) {
    const innerRingNode = innerNodes[i].getElementsByTagName('LinearRing')[0];
    if (innerRingNode) {
      const innerRing = parseLinearRing(innerRingNode, warnings);
      if (innerRing) rings.push(innerRing);
    }
  }

  const alt = outerRing[0]?.[2];
  return {
    type: 'Polygon',
    coordinates: rings,
    altitude: alt,
  };
}

function parseMultiGeometry(
  node: Element,
  warnings: string[]
): any | null {
  const geometries: any[] = [];

  for (let i = 0; i < node.childNodes.length; i++) {
    const child = node.childNodes[i] as Element;
    if (child.nodeType !== 1) continue;
    const tag = child.localName || child.tagName;

    if (tag === 'Point') {
      const g = parsePoint(child, warnings);
      if (g) geometries.push(g);
    } else if (tag === 'LineString') {
      const g = parseLineString(child, warnings);
      if (g) geometries.push(g);
    } else if (tag === 'Polygon') {
      const g = parsePolygon(child, warnings);
      if (g) geometries.push(g);
    } else if (tag === 'MultiGeometry') {
      const g = parseMultiGeometry(child, warnings);
      if (g) geometries.push(g);
    }
  }

  if (geometries.length === 0) return null;
  if (geometries.length === 1) return geometries[0];

  // If all are Polygons -> MultiPolygon
  const allPolygons = geometries.every((g) => g.type === 'Polygon');
  if (allPolygons) {
    return {
      type: 'MultiPolygon',
      coordinates: geometries.map((g) => g.coordinates),
      altitude: geometries[0].altitude,
    };
  }

  // If all are LineStrings -> MultiLineString
  const allLines = geometries.every((g) => g.type === 'LineString');
  if (allLines) {
    return {
      type: 'MultiLineString',
      coordinates: geometries.map((g) => g.coordinates),
      altitude: geometries[0].altitude,
    };
  }

  // If all are Points -> MultiPoint
  const allPoints = geometries.every((g) => g.type === 'Point');
  if (allPoints) {
    return {
      type: 'MultiPoint',
      coordinates: geometries.map((g) => g.coordinates),
      altitude: geometries[0].altitude,
    };
  }

  // Otherwise GeometryCollection
  return {
    type: 'GeometryCollection',
    geometries,
  };
}

function parseExtendedData(placemarkNode: Element): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {};

  const extDataNode = placemarkNode.getElementsByTagName('ExtendedData')[0];
  if (!extDataNode) return result;

  // 1. <Data name="key"><value>val</value></Data>
  const dataNodes = extDataNode.getElementsByTagName('Data');
  for (let i = 0; i < dataNodes.length; i++) {
    const node = dataNodes[i];
    const name = node.getAttribute('name');
    if (!name) continue;
    const value = node.getElementsByTagName('value')[0]?.textContent?.trim() || '';
    result[name] = sanitizeHtml(value);
  }

  // 2. <SchemaData><SimpleData name="key">val</SimpleData></SchemaData>
  const simpleDataNodes = extDataNode.getElementsByTagName('SimpleData');
  for (let i = 0; i < simpleDataNodes.length; i++) {
    const node = simpleDataNodes[i];
    const name = node.getAttribute('name');
    if (!name) continue;
    const value = node.textContent?.trim() || '';
    result[name] = sanitizeHtml(value);
  }

  return result;
}

// ==========================================
// Main KML Document Parser
// ==========================================

export function parseKml(
  xmlContent: string,
  filename = 'imported.kml'
): KmlParseResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  let doc: Document;
  try {
    doc = parseXmlDoc(xmlContent);
  } catch (err: any) {
    return {
      success: false,
      errors: [err.message || 'ไม่สามารถเปิดอ่านไฟล์ XML ได้เนื่องจากรูปแบบเสียหาย'],
      warnings,
    };
  }

  const stylesMap = extractStyles(doc);
  const features: KmlFeature[] = [];
  const folders: string[] = [];
  let pointsCount = 0;
  let linesCount = 0;
  let polygonsCount = 0;
  let multiCount = 0;
  let hasGroundOverlay = false;

  // Process Placemarks
  const placemarks = doc.getElementsByTagName('Placemark');

  for (let i = 0; i < placemarks.length; i++) {
    if (features.length >= KMZ_LIMITS.MAX_FEATURES_PER_FILE) {
      warnings.push(`จำนวน Feature เกินขีดจำกัดสูงสุด ${KMZ_LIMITS.MAX_FEATURES_PER_FILE} รายการ ส่วนที่เหลือถูกตัดทอน`);
      break;
    }

    const pm = placemarks[i];
    const name = sanitizeHtml(pm.getElementsByTagName('name')[0]?.textContent?.trim() || `Feature ${i + 1}`);
    const description = sanitizeHtml(pm.getElementsByTagName('description')[0]?.textContent?.trim() || '');
    const styleUrl = pm.getElementsByTagName('styleUrl')[0]?.textContent?.trim();

    // Check style
    let style = styleUrl ? stylesMap.get(styleUrl) || stylesMap.get(styleUrl.replace(/^#/, '')) : undefined;
    const inlineStyleNode = pm.getElementsByTagName('Style')[0];
    if (inlineStyleNode) {
      const inlineProps: KmlStyleProperties = {};
      const lineStyle = inlineStyleNode.getElementsByTagName('LineStyle')[0];
      if (lineStyle) {
        const c = parseKmlColor(lineStyle.getElementsByTagName('color')[0]?.textContent);
        if (c) {
          inlineProps.strokeColor = c.colorHex;
          inlineProps.strokeOpacity = c.opacity;
        }
        const w = lineStyle.getElementsByTagName('width')[0]?.textContent;
        if (w) inlineProps.strokeWidth = parseFloat(w);
      }
      const polyStyle = inlineStyleNode.getElementsByTagName('PolyStyle')[0];
      if (polyStyle) {
        const c = parseKmlColor(polyStyle.getElementsByTagName('color')[0]?.textContent);
        if (c) {
          inlineProps.fillColor = c.colorHex;
          inlineProps.fillOpacity = c.opacity;
        }
      }
      style = { ...style, ...inlineProps };
    }

    // Determine Folder Name
    let parentFolder = pm.parentElement;
    let folderName: string | undefined;
    while (parentFolder && parentFolder !== doc.documentElement) {
      if (parentFolder.tagName === 'Folder') {
        const fName = parentFolder.getElementsByTagName('name')[0]?.textContent?.trim();
        if (fName) {
          folderName = sanitizeHtml(fName);
          if (!folders.includes(folderName)) folders.push(folderName);
        }
        break;
      }
      parentFolder = parentFolder.parentElement;
    }

    const altitudeMode = parseAltitudeMode(pm);
    const extendedData = parseExtendedData(pm);

    // Parse Geometry inside Placemark
    let geomResult: any = null;
    const pointNode = pm.getElementsByTagName('Point')[0];
    const lineNode = pm.getElementsByTagName('LineString')[0];
    const polyNode = pm.getElementsByTagName('Polygon')[0];
    const multiNode = pm.getElementsByTagName('MultiGeometry')[0];

    if (pointNode) {
      geomResult = parsePoint(pointNode, warnings);
      if (geomResult) pointsCount++;
    } else if (lineNode) {
      geomResult = parseLineString(lineNode, warnings);
      if (geomResult) linesCount++;
    } else if (polyNode) {
      geomResult = parsePolygon(polyNode, warnings);
      if (geomResult) polygonsCount++;
    } else if (multiNode) {
      geomResult = parseMultiGeometry(multiNode, warnings);
      if (geomResult) multiCount++;
    }

    if (geomResult) {
      features.push({
        type: 'Feature',
        id: pm.getAttribute('id') || `kml-feat-${i + 1}`,
        geometry: geomResult,
        properties: {
          name,
          description,
          altitudeMode,
          altitude: geomResult.altitude,
          folderName,
          extendedData: Object.keys(extendedData).length > 0 ? extendedData : undefined,
          style,
          sourceFile: filename,
        },
      });
    }
  }

  // Support GroundOverlay
  const groundOverlays = doc.getElementsByTagName('GroundOverlay');
  for (let g = 0; g < groundOverlays.length; g++) {
    hasGroundOverlay = true;
    const go = groundOverlays[g];
    const name = sanitizeHtml(go.getElementsByTagName('name')[0]?.textContent?.trim() || `GroundOverlay ${g + 1}`);
    const description = sanitizeHtml(go.getElementsByTagName('description')[0]?.textContent?.trim() || '');
    const latLonBox = go.getElementsByTagName('LatLonBox')[0];
    const iconHref = go.getElementsByTagName('Icon')[0]?.getElementsByTagName('href')[0]?.textContent?.trim();

    if (latLonBox) {
      const north = parseFloat(latLonBox.getElementsByTagName('north')[0]?.textContent || '0');
      const south = parseFloat(latLonBox.getElementsByTagName('south')[0]?.textContent || '0');
      const east = parseFloat(latLonBox.getElementsByTagName('east')[0]?.textContent || '0');
      const west = parseFloat(latLonBox.getElementsByTagName('west')[0]?.textContent || '0');
      const rotation = parseFloat(latLonBox.getElementsByTagName('rotation')[0]?.textContent || '0');

      if (!isNaN(north) && !isNaN(south) && !isNaN(east) && !isNaN(west)) {
        polygonsCount++;
        features.push({
          type: 'Feature',
          id: `ground-overlay-${g + 1}`,
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [west, north],
                [east, north],
                [east, south],
                [west, south],
                [west, north],
              ],
            ],
          },
          properties: {
            name,
            description,
            altitudeMode: 'clampToGround',
            isGroundOverlay: true,
            groundOverlay: {
              north,
              south,
              east,
              west,
              rotation,
              iconHref,
            },
            sourceFile: filename,
          },
        });
      }
    }
  }

  if (features.length === 0) {
    errors.push('ไฟล์ KML ไม่มีองค์ประกอบเชิงพื้นที่ (Geometry) ที่ระบบรองรับ');
    return {
      success: false,
      errors,
      warnings,
    };
  }

  const featureCollection: KmlFeatureCollection = {
    type: 'FeatureCollection',
    name: doc.getElementsByTagName('Document')[0]?.getElementsByTagName('name')[0]?.textContent?.trim() || filename,
    description: doc.getElementsByTagName('Document')[0]?.getElementsByTagName('description')[0]?.textContent?.trim(),
    features,
    metadata: {
      originalFilename: filename,
      fileFormat: filename.toLowerCase().endsWith('.kmz') ? 'kmz' : 'kml',
      fileSizeBytes: xmlContent.length,
      crs: 'EPSG:4326',
      altitudeReference: 'WGS84 Ellipsoid / ClampToGround',
      featureCount: features.length,
      geometrySummary: {
        points: pointsCount,
        lines: linesCount,
        polygons: polygonsCount,
        multiGeometries: multiCount,
      },
      hasGroundOverlay,
      folders,
      warnings,
    },
  };

  return {
    success: true,
    featureCollection,
    warnings,
  };
}

// ==========================================
// KMZ Safe ZIP Extractor & Parser
// ==========================================

export async function parseKmz(
  zipBuffer: ArrayBuffer | Uint8Array,
  filename = 'imported.kmz'
): Promise<KmlParseResult> {
  const warnings: string[] = [];
  const errors: string[] = [];

  // 1. Check archive size
  if (zipBuffer.byteLength > KMZ_LIMITS.MAX_ARCHIVE_SIZE_BYTES) {
    return {
      success: false,
      errors: [`ขนาดไฟล์ KMZ (${(zipBuffer.byteLength / 1024 / 1024).toFixed(1)} MB) เกินขีดจำกัดที่ปลอดภัย (${KMZ_LIMITS.MAX_ARCHIVE_SIZE_BYTES / 1024 / 1024} MB)`],
      warnings,
    };
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(zipBuffer);
  } catch (err: any) {
    return {
      success: false,
      errors: ['โครงสร้างไฟล์ KMZ เสียหาย หรือไม่ใช่ไฟล์ ZIP ที่ถูกต้อง: ' + (err.message || '')],
      warnings,
    };
  }

  // 2. Inspect ZIP entries for Zip Slip & ZIP Bomb
  const entries = Object.keys(zip.files);
  if (entries.length === 0) {
    return {
      success: false,
      errors: ['ไฟล์ KMZ ว่างเปล่า ไม่มีข้อมูลภายใน'],
      warnings,
    };
  }

  if (entries.length > KMZ_LIMITS.MAX_FILE_COUNT) {
    return {
      success: false,
      errors: [`จำนวนไฟล์ภายใน KMZ (${entries.length}) เกินขีดจำกัด ${KMZ_LIMITS.MAX_FILE_COUNT} ไฟล์`],
      warnings,
    };
  }

  let totalUncompressedSize = 0;
  let primaryKmlName: string | null = null;
  const localAssetsMap = new Map<string, string>(); // relative path -> data URL

  for (const entryPath of entries) {
    // Zip Slip defense
    if (entryPath.includes('..') || entryPath.startsWith('/') || /^[a-zA-Z]:/.test(entryPath)) {
      return {
        success: false,
        errors: [`ZIP_SLIP_DETECTED: ตรวจพบ Path Traversal ผิดกฎหมายในไฟล์: "${entryPath}"`],
        warnings,
      };
    }

    const zipObj = zip.files[entryPath];
    if (zipObj.dir) continue;

    // Accumulate uncompressed size (approximate or via data)
    // In JSZip _data or asUint8Array
    const size = (zipObj as any)._data?.uncompressedSize || 0;
    totalUncompressedSize += size;

    if (totalUncompressedSize > KMZ_LIMITS.MAX_UNCOMPRESSED_SIZE_BYTES) {
      return {
        success: false,
        errors: [`ZIP_BOMB_PREVENTION: ขนาดข้อมูลหลังแตกไฟล์ (${(totalUncompressedSize / 1024 / 1024).toFixed(1)} MB) เกินขีดจำกัดปลอดภัย`],
        warnings,
      };
    }

    const lower = entryPath.toLowerCase();
    if (lower.endsWith('.kml')) {
      if (!primaryKmlName) {
        primaryKmlName = entryPath;
      } else if (lower.endsWith('doc.kml') || lower === 'doc.kml') {
        // Prefer doc.kml if multiple exist
        primaryKmlName = entryPath;
      }
    }
  }

  if (!primaryKmlName) {
    return {
      success: false,
      errors: ['ไม่พบไฟล์ .kml หลักภายในไฟล์ KMZ'],
      warnings,
    };
  }

  // Read primary KML
  const kmlFile = zip.files[primaryKmlName];
  if (!kmlFile) {
    return {
      success: false,
      errors: [`ไม่สามารถเข้าถึงไฟล์ KML หลัก: ${primaryKmlName}`],
      warnings,
    };
  }

  let kmlText: string;
  try {
    kmlText = await kmlFile.async('text');
  } catch (err: any) {
    return {
      success: false,
      errors: ['ไม่สามารถอ่านเนื้อหาของไฟล์ KML ใน KMZ ได้: ' + err.message],
      warnings,
    };
  }

  // Parse KML text
  const parseResult = parseKml(kmlText, filename);
  if (!parseResult.success || !parseResult.featureCollection) {
    return parseResult;
  }

  // Extract embedded local icon/overlay assets as base64 (if under safe limit)
  for (const entryPath of entries) {
    const lower = entryPath.toLowerCase();
    if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.svg')) {
      try {
        const fileObj = zip.files[entryPath];
        const bytes = await fileObj.async('uint8array');
        if (bytes.byteLength < 5 * 1024 * 1024) { // max 5MB per asset
          const mime = lower.endsWith('.png')
            ? 'image/png'
            : lower.endsWith('.svg')
            ? 'image/svg+xml'
            : 'image/jpeg';
          
          let binary = '';
          const len = bytes.byteLength;
          for (let b = 0; b < len; b++) {
            binary += String.fromCharCode(bytes[b]);
          }
          const base64 = typeof btoa !== 'undefined' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
          localAssetsMap.set(entryPath, `data:${mime};base64,${base64}`);
        }
      } catch {
        warnings.push(`ไม่สามารถแปลงรูปภาพประกอบ "${entryPath}" ใน KMZ`);
      }
    }
  }

  // Link local icon assets to feature styles
  if (localAssetsMap.size > 0 && parseResult.featureCollection) {
    for (const feat of parseResult.featureCollection.features) {
      const iconUrl = feat.properties.style?.iconUrl;
      if (iconUrl && localAssetsMap.has(iconUrl)) {
        feat.properties.style!.iconUrl = localAssetsMap.get(iconUrl);
      }
      if (feat.properties.groundOverlay?.iconHref && localAssetsMap.has(feat.properties.groundOverlay.iconHref)) {
        feat.properties.groundOverlay.iconHref = localAssetsMap.get(feat.properties.groundOverlay.iconHref);
      }
    }
  }

  parseResult.featureCollection.metadata = {
    ...parseResult.featureCollection.metadata!,
    originalFilename: filename,
    fileFormat: 'kmz',
    fileSizeBytes: zipBuffer.byteLength,
  };

  return parseResult;
}

// ==========================================
// KML / KMZ Re-Export Engine (Section 10.8)
// ==========================================

export function exportFeaturesToKml(
  features: KmlFeature[],
  documentName = 'Exported_Layer',
  description = 'ส่งออกจากระบบ GeoMonitor 3D'
): string {
  const styles: string[] = [];
  const placemarks: string[] = [];

  // Default Layer Style
  styles.push(`
    <Style id="defaultPolyStyle">
      <LineStyle>
        <color>ff00ffff</color>
        <width>2.5</width>
      </LineStyle>
      <PolyStyle>
        <color>4d00ffff</color>
        <fill>1</fill>
        <outline>1</outline>
      </PolyStyle>
    </Style>
    <Style id="defaultLineStyle">
      <LineStyle>
        <color>ff38bdf8</color>
        <width>3.0</width>
      </LineStyle>
    </Style>
    <Style id="defaultPointStyle">
      <IconStyle>
        <scale>1.1</scale>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/pushpin/ylw-pushpin.png</href>
        </Icon>
      </IconStyle>
    </Style>
  `);

  for (let idx = 0; idx < features.length; idx++) {
    const f = features[idx];
    const props = f.properties || {};
    const name = props.name || `Feature ${idx + 1}`;
    const desc = props.description ? `<![CDATA[${props.description}]]>` : '';
    const altMode = props.altitudeMode || 'clampToGround';

    let geomXml = '';

    if (f.geometry.type === 'Point') {
      const coords = f.geometry.coordinates;
      const lon = coords[0];
      const lat = coords[1];
      const alt = coords.length > 2 ? coords[2] : 0;
      geomXml = `
        <Point>
          <altitudeMode>${altMode}</altitudeMode>
          <coordinates>${lon},${lat},${alt}</coordinates>
        </Point>
      `;
    } else if (f.geometry.type === 'LineString') {
      const coordsStr = f.geometry.coordinates
        .map((c: number[]) => `${c[0]},${c[1]},${c.length > 2 ? c[2] : 0}`)
        .join(' ');
      geomXml = `
        <LineString>
          <altitudeMode>${altMode}</altitudeMode>
          <coordinates>${coordsStr}</coordinates>
        </LineString>
      `;
    } else if (f.geometry.type === 'Polygon') {
      const outerRing = f.geometry.coordinates[0];
      const outerStr = outerRing
        .map((c: number[]) => `${c[0]},${c[1]},${c.length > 2 ? c[2] : 0}`)
        .join(' ');

      let innerXml = '';
      for (let r = 1; r < f.geometry.coordinates.length; r++) {
        const innerStr = f.geometry.coordinates[r]
          .map((c: number[]) => `${c[0]},${c[1]},${c.length > 2 ? c[2] : 0}`)
          .join(' ');
        innerXml += `
          <innerBoundaryIs>
            <LinearRing>
              <coordinates>${innerStr}</coordinates>
            </LinearRing>
          </innerBoundaryIs>
        `;
      }

      geomXml = `
        <Polygon>
          <altitudeMode>${altMode}</altitudeMode>
          <outerBoundaryIs>
            <LinearRing>
              <coordinates>${outerStr}</coordinates>
            </LinearRing>
          </outerBoundaryIs>
          ${innerXml}
        </Polygon>
      `;
    } else if (f.geometry.type === 'MultiPolygon') {
      const polysXml = f.geometry.coordinates.map((polyCoords: number[][][]) => {
        const outerStr = polyCoords[0].map((c) => `${c[0]},${c[1]},${c.length > 2 ? c[2] : 0}`).join(' ');
        return `
          <Polygon>
            <altitudeMode>${altMode}</altitudeMode>
            <outerBoundaryIs>
              <LinearRing>
                <coordinates>${outerStr}</coordinates>
              </LinearRing>
            </outerBoundaryIs>
          </Polygon>
        `;
      }).join('\n');

      geomXml = `
        <MultiGeometry>
          ${polysXml}
        </MultiGeometry>
      `;
    }

    let extendedDataXml = '';
    if (props.extendedData && Object.keys(props.extendedData).length > 0) {
      extendedDataXml = '<ExtendedData>\n' +
        Object.entries(props.extendedData)
          .map(([k, v]) => `  <Data name="${k}"><value>${v}</value></Data>`)
          .join('\n') +
        '\n</ExtendedData>';
    }

    const styleUrl =
      f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'
        ? '#defaultPolyStyle'
        : f.geometry.type === 'LineString'
        ? '#defaultLineStyle'
        : '#defaultPointStyle';

    placemarks.push(`
      <Placemark id="${f.id || `pm-${idx + 1}`}">
        <name>${name}</name>
        <description>${desc}</description>
        <styleUrl>${styleUrl}</styleUrl>
        ${extendedDataXml}
        ${geomXml}
      </Placemark>
    `);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2">
  <Document>
    <name>${documentName}</name>
    <description><![CDATA[${description}]]></description>
    ${styles.join('\n')}
    ${placemarks.join('\n')}
  </Document>
</kml>`.trim();
}

export async function exportFeaturesToKmz(
  features: KmlFeature[],
  documentName = 'Exported_Layer'
): Promise<Uint8Array> {
  const kmlString = exportFeaturesToKml(features, documentName);
  const zip = new JSZip();
  zip.file('doc.kml', kmlString);
  return await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}
