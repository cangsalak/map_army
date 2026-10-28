/**
 * Thai Translations and GIS Terminology
 */

export const THAI_TEXT = {
  appName: 'GeoMonitor 3D',
  appSubtitle: 'ระบบติดตามและวิเคราะห์การเปลี่ยนแปลงพื้นที่ 3 มิติจากภาพถ่ายโดรน',
  
  roles: {
    admin: 'ผู้ดูแลระบบสูงสุด (Administrator)',
    project_manager: 'ผู้จัดการโครงการ (Project Manager)',
    analyst: 'นักวิเคราะห์ข้อมูลภูมิสารสนเทศ (GIS Analyst)',
    viewer: 'ผู้เข้าชมทั่วไป (Viewer)',
  },

  areaStatus: {
    active: 'กำลังใช้งาน',
    monitoring: 'อยู่ระหว่างเฝ้าระวัง',
    archived: 'จัดเก็บในคลังประวัติ',
  },

  surveyStatus: {
    pending: 'รอดำเนินการ',
    processing: 'กำลังประมวลผล',
    completed: 'เสร็จสมบูรณ์',
    failed: 'ประมวลผลล้มเหลว',
  },

  assetTypes: {
    orthomosaic: 'ภาพถ่ายออร์โธโมเสก (Orthomosaic)',
    cog_raster: 'ราสเตอร์แบบ COG (Cloud Optimized GeoTIFF)',
    dsm_raster: 'แบบจำลองระดับความสูงพื้นผิว (DSM)',
    dtm_raster: 'แบบจำลองระดับความสูงภูมิประเทศ (DTM)',
    point_cloud_las: 'กลุ่มจุดพอยต์คลาวด์ (LAS/LAZ)',
    tiles_3d: 'โมเดล 3 มิติ (Cesium 3D Tiles)',
    geojson_vector: 'ข้อมูลเวกเตอร์ (GeoJSON)',
    report_pdf: 'เอกสารรายงาน (PDF)',
  },

  analysisTypes: {
    level1_image: 'ระดับที่ 1: การเปรียบเทียบภาพถ่ายออร์โธ (Image Difference)',
    level2_elevation: 'ระดับที่ 2: การวิเคราะห์ระดับความสูงและปริมาตรขุดถม (Elevation Cut/Fill)',
    combined: 'การวิเคราะห์แบบบูรณาการภาพและระดับความสูง (Combined Analysis)',
  },

  featureTypes: {
    earthwork_cut: 'พื้นที่ขุดดิน (Excavation / Cut)',
    earthwork_fill: 'พื้นที่ถมดิน (Accretion / Fill)',
    construction_new: 'สิ่งปลูกสร้าง/โครงสร้างใหม่ (New Structure)',
    vegetation_clearing: 'การเปิดหน้าดิน/ตัดไม้ (Vegetation Clearing)',
    water_body_change: 'การเปลี่ยนแปลงของแหล่งน้ำ (Water Body Shift)',
    unclassified_anomaly: 'ความผิดปกติที่รอการจำแนก (Unclassified)',
  },

  reviewStatus: {
    candidate: 'ผู้สมัครการเปลี่ยนแปลง (ตรวจพบอัตโนมัติ)',
    confirmed_change: 'ยืนยันการเปลี่ยนแปลงจริงโดยนักวิเคราะห์',
    false_positive_shadow: 'ผลบวกลวงจากเงาและแสงสะท้อน',
    false_positive_vegetation: 'ผลบวกลวงจากฤดูกาลพืชพรรณ',
    false_positive_misalignment: 'ผลบวกลวงจากความคลาดเคลื่อนทางพิกัด',
  },

  units: {
    sqm: 'ตร.ม.',
    sqkm: 'ตร.กม.',
    rai: 'ไร่',
    cum: 'ลบ.ม.',
    meter: 'ม.',
    cm: 'ซม.',
  }
} as const;

export function formatAreaThai(sqm: number): string {
  if (sqm >= 1_000_000) {
    return `${(sqm / 1_000_000).toLocaleString('th-TH', { maximumFractionDigits: 2 })} ตร.กม. (${(sqm / 1600).toLocaleString('th-TH', { maximumFractionDigits: 1 })} ไร่)`;
  }
  return `${sqm.toLocaleString('th-TH', { maximumFractionDigits: 1 })} ตร.ม. (${(sqm / 1600).toLocaleString('th-TH', { maximumFractionDigits: 2 })} ไร่)`;
}

export function formatVolumeThai(cum: number): string {
  return `${cum.toLocaleString('th-TH', { maximumFractionDigits: 2 })} ลบ.ม.`;
}
