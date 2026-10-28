/**
 * GeoMonitor 3D Spatial Constants & Reference Systems
 */

export const CRS = {
  WGS84: 'EPSG:4326',
  WEB_MERCATOR: 'EPSG:3857',
  UTM_ZONE_47N: 'EPSG:32647', // Western & Central Thailand (Bangkok, Chiang Mai, Phuket)
  UTM_ZONE_48N: 'EPSG:32648', // Eastern & Northeastern Thailand (Rayong, Ubon, Khon Kaen)
} as const;

export const THAILAND_BBOX = {
  minLon: 97.3436,
  minLat: 5.6130,
  maxLon: 105.6369,
  maxLat: 20.4649,
};

/**
 * Master Map Bearing Standard:
 * Signed Bearing: -90° (West)
 * Engine Heading (0-360° range clockwise from North): 270°
 * Radians: 270 * (PI / 180) = 4.71238898 rad
 */
export const MAP_BEARING = {
  SIGNED_DEG: -90,
  CESIUM_DEG: 270,
  CESIUM_RAD: (270 * Math.PI) / 180,
} as const;

export function toSignedBearing(deg: number): number {
  const normalized = ((deg % 360) + 360) % 360;
  return normalized > 180 ? normalized - 360 : normalized;
}

export function fromSignedBearing(signedDeg: number): number {
  return ((signedDeg % 360) + 360) % 360;
}

export const DEFAULT_MAP_CENTER = {
  // Strategic monitoring initial center
  longitude: 100.5018,
  latitude: 13.7563,
  height: 2500,
  pitch: -45,
  heading: MAP_BEARING.CESIUM_DEG,
};

export const DEMO_AREAS_COORDINATES = {
  MAP_TA_PHUT: {
    name: 'นิคมอุตสาหกรรมมาบตาพุด ระยะที่ 3 (Rayong)',
    center: [101.145, 12.675],
    coordinates: [
      [101.1350, 12.6680],
      [101.1550, 12.6680],
      [101.1550, 12.6820],
      [101.1350, 12.6820],
      [101.1350, 12.6680]
    ]
  },
  MAE_MOH_MINE: {
    name: 'เหมืองแม่เมาะ กฟผ. (Lampang Open-Pit Mine)',
    center: [99.715, 18.295],
    coordinates: [
      [99.7050, 18.2850],
      [99.7280, 18.2850],
      [99.7280, 18.3050],
      [99.7050, 18.3050],
      [99.7050, 18.2850]
    ]
  },
  SUVARNABHUMI_EXPANSION: {
    name: 'โครงการพัฒนาท่าอากาศยานสุวรรณภูมิ ส่วนต่อขยาย (Samut Prakan)',
    center: [100.750, 13.690],
    coordinates: [
      [100.7380, 13.6800],
      [100.7620, 13.6800],
      [100.7620, 13.7000],
      [100.7380, 13.7000],
      [100.7380, 13.6800]
    ]
  }
};
