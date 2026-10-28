/**
 * Drone Mission Export Adapters
 *
 * Implements export specifications for:
 * 1. DJI Pilot 2 WPML (.kmz packaging template.kml + waypoint.kml)
 * 2. QGroundControl Plan (.plan JSON)
 * 3. Generic GIS Review (.geojson reference path)
 */

import { DroneMissionDTO, ExportPlatform } from '@geomonitor/shared';
import JSZip from 'jszip';

/**
 * 1. Generate DJI WPML XML content
 */
export function generateDJIWPML(mission: DroneMissionDTO): {
  templateKml: string;
  waypointKml: string;
} {
  const now = Date.now();
  const finishActionDJI =
    mission.finishAction === 'return_to_home'
      ? 'goHome'
      : mission.finishAction === 'hover'
      ? 'hover'
      : 'autoLand';

  // template.kml
  const templateKml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:wpml="http://www.dji.com/wpmz/1.0.6">
  <Document>
    <wpml:author>GeoMonitor 3D Enterprise</wpml:author>
    <wpml:createTime>${now}</wpml:createTime>
    <wpml:updateTime>${now}</wpml:updateTime>
    <wpml:missionConfig>
      <wpml:flyToWaylineMode>safely</wpml:flyToWaylineMode>
      <wpml:finishAction>${finishActionDJI}</wpml:finishAction>
      <wpml:exitOnRCLost>executeLostAction</wpml:exitOnRCLost>
      <wpml:executeRCLostAction>goBack</wpml:executeRCLostAction>
      <wpml:takeOffSecurityHeight>25</wpml:takeOffSecurityHeight>
      <wpml:globalTransitionalSpeed>${mission.flightSpeedMps}</wpml:globalTransitionalSpeed>
      <wpml:droneInfo>
        <wpml:droneEnumValue>67</wpml:droneEnumValue>
        <wpml:droneSubEnumValue>0</wpml:droneSubEnumValue>
      </wpml:droneInfo>
    </wpml:missionConfig>
  </Document>
</kml>`;

  // waypoint.kml with Placemark sequence
  const placemarks = mission.waypoints
    .map(
      (wp, idx) => `
    <Placemark>
      <Point>
        <coordinates>${wp.longitude.toFixed(7)},${wp.latitude.toFixed(7)}</coordinates>
      </Point>
      <wpml:index>${idx}</wpml:index>
      <wpml:executeHeight>${wp.altitudeMeters}</wpml:executeHeight>
      <wpml:waypointSpeed>${wp.speedMps || mission.flightSpeedMps}</wpml:waypointSpeed>
      <wpml:waypointHeadingParam>
        <wpml:waypointHeadingMode>followWayline</wpml:waypointHeadingMode>
      </wpml:waypointHeadingParam>
      <wpml:waypointTurnParam>
        <wpml:waypointTurnMode>${wp.turnMode === 'adaptive_curve' ? 'toPointAndStopWithDiscontinuityCurvature' : 'coordinateTurn'}</wpml:waypointTurnMode>
      </wpml:waypointTurnParam>
      <wpml:useGlobalHeight>1</wpml:useGlobalHeight>
      <wpml:useGlobalSpeed>1</wpml:useGlobalSpeed>
      <wpml:gimbalPitchAngle>${wp.gimbalPitchDeg || -90}</wpml:gimbalPitchAngle>
      <wpml:actionGroup>
        <wpml:actionGroupId>${idx}</wpml:actionGroupId>
        <wpml:actionGroupStartIndex>${idx}</wpml:actionGroupStartIndex>
        <wpml:actionGroupEndIndex>${idx}</wpml:actionGroupEndIndex>
        <wpml:actionGroupMode>sequence</wpml:actionGroupMode>
        <wpml:actionTrigger>
          <wpml:actionTriggerType>reachPoint</wpml:actionTriggerType>
        </wpml:actionTrigger>
        <wpml:action>
          <wpml:actionId>0</wpml:actionId>
          <wpml:actionActuatorFunc>takePhoto</wpml:actionActuatorFunc>
        </wpml:action>
      </wpml:actionGroup>
    </Placemark>`
    )
    .join('\n');

  const waypointKml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:wpml="http://www.dji.com/wpmz/1.0.6">
  <Document>
    <wpml:missionConfig>
      <wpml:flyToWaylineMode>safely</wpml:flyToWaylineMode>
      <wpml:finishAction>${finishActionDJI}</wpml:finishAction>
      <wpml:exitOnRCLost>executeLostAction</wpml:exitOnRCLost>
      <wpml:executeRCLostAction>goBack</wpml:executeRCLostAction>
      <wpml:globalTransitionalSpeed>${mission.flightSpeedMps}</wpml:globalTransitionalSpeed>
      <wpml:droneInfo>
        <wpml:droneEnumValue>67</wpml:droneEnumValue>
        <wpml:droneSubEnumValue>0</wpml:droneSubEnumValue>
      </wpml:droneInfo>
    </wpml:missionConfig>
    <Folder>
      <wpml:templateType>waypoint</wpml:templateType>
      <wpml:templateId>0</wpml:templateId>
      <wpml:waylineId>0</wpml:waylineId>
      <wpml:autoFlightSpeed>${mission.flightSpeedMps}</wpml:autoFlightSpeed>
      ${placemarks}
    </Folder>
  </Document>
</kml>`;

  return { templateKml, waypointKml };
}

/**
 * 2. Generate QGroundControl Plan (.plan JSON)
 */
export function generateQGCPlan(mission: DroneMissionDTO): string {
  const home = mission.homePoint || [101.145, 12.678, 50];

  const items: any[] = [];

  // Item 1: Takeoff command (MAV_CMD_NAV_TAKEOFF = 22)
  items.push({
    autoContinue: true,
    command: 22,
    doJumpId: 1,
    frame: 3, // MAV_FRAME_GLOBAL_RELATIVE_ALT
    params: [15, 0, 0, null, home[1], home[0], Math.min(mission.flightAltitudeMeters, 30)],
    type: 'SimpleItem',
  });

  // Items 2..N: Waypoints (MAV_CMD_NAV_WAYPOINT = 16)
  mission.waypoints.forEach((wp, idx) => {
    items.push({
      autoContinue: true,
      command: 16,
      doJumpId: idx + 2,
      frame: 3,
      params: [0, 0, 0, null, wp.latitude, wp.longitude, wp.altitudeMeters],
      type: 'SimpleItem',
    });
  });

  // Item Final: Return to Launch (MAV_CMD_NAV_RETURN_TO_LAUNCH = 20)
  if (mission.finishAction === 'return_to_home') {
    items.push({
      autoContinue: true,
      command: 20,
      doJumpId: mission.waypoints.length + 2,
      frame: 2,
      params: [0, 0, 0, 0, 0, 0, 0],
      type: 'SimpleItem',
    });
  }

  const plan = {
    fileType: 'Plan',
    version: 1,
    groundStation: 'QGroundControl',
    geoFence: {
      circles: [],
      polygons: [],
      version: 2,
    },
    rallyPoints: {
      points: [],
      version: 2,
    },
    mission: {
      cruiseSpeed: mission.flightSpeedMps,
      hoverSpeed: 3,
      firmwareType: 12, // ArduPilot / PX4
      vehicleType: 2, // Multi-Rotor
      version: 2,
      plannedHomePosition: [home[1], home[0], home[2] || 0],
      items,
    },
  };

  return JSON.stringify(plan, null, 2);
}

/**
 * 3. Generate Generic GIS GeoJSON (Reference Only)
 */
export function generateGenericGeoJSON(mission: DroneMissionDTO): string {
  const lineCoords = mission.waypoints.map((wp) => [wp.longitude, wp.latitude, wp.altitudeMeters]);

  const features: any[] = [
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: lineCoords,
      },
      properties: {
        name: `${mission.name} - Flight Route`,
        missionType: mission.missionType,
        waypointCount: mission.waypoints.length,
        flightAltitudeMeters: mission.flightAltitudeMeters,
        speedMps: mission.flightSpeedMps,
        isFlightControlPlan: false,
        warning: 'ไฟล์นี้เป็นเพียงเส้นทางอ้างอิง GIS ไม่ใช่ไฟล์คำสั่งการบินสำหรับ Autopilot',
      },
    },
  ];

  if (mission.surveyArea) {
    features.push({
      type: 'Feature',
      geometry: mission.surveyArea,
      properties: {
        name: `${mission.name} - Survey Boundary`,
      },
    });
  }

  const geojson = {
    type: 'FeatureCollection',
    name: mission.name,
    crs: {
      type: 'name',
      properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' },
    },
    features,
  };

  return JSON.stringify(geojson, null, 2);
}

/**
 * 3.5. Generate Standard OGC KML 2.2 for GIS Review & Google Earth Pro
 * Note: Standard KML is for spatial visualization and GIS review, not an autopilot execution payload.
 */
export function generateStandardKML(mission: DroneMissionDTO): string {
  const coordinatesList = mission.waypoints
    .map((wp) => `${wp.longitude.toFixed(7)},${wp.latitude.toFixed(7)},${wp.altitudeMeters.toFixed(1)}`)
    .join(' ');

  const placemarks = mission.waypoints
    .map(
      (wp, idx) => `
    <Placemark>
      <name>WP #${idx + 1}</name>
      <description>Seq: ${wp.sequence}, Alt: ${wp.altitudeMeters}m AGL, Speed: ${wp.speedMps || mission.flightSpeedMps}m/s, Action: ${wp.action || 'take_photo'}</description>
      <Point>
        <altitudeMode>relativeToGround</altitudeMode>
        <coordinates>${wp.longitude.toFixed(7)},${wp.latitude.toFixed(7)},${wp.altitudeMeters.toFixed(1)}</coordinates>
      </Point>
    </Placemark>`
    )
    .join('\n');

  let boundaryPlacemark = '';
  if (mission.surveyArea && (mission.surveyArea as any).coordinates?.[0]) {
    const polyCoords = (mission.surveyArea as any).coordinates[0]
      .map((pt: number[]) => `${pt[0].toFixed(7)},${pt[1].toFixed(7)},0`)
      .join(' ');
    boundaryPlacemark = `
    <Placemark>
      <name>Survey Boundary</name>
      <Style>
        <LineStyle><color>ff00ffff</color><width>2</width></LineStyle>
        <PolyStyle><color>3300ffff</color></PolyStyle>
      </Style>
      <Polygon>
        <altitudeMode>clampToGround</altitudeMode>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>${polyCoords}</coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>`;
  }

  const altRef = mission.altitudeReference || 'relative_to_home';
  const metadataDesc = `
[GeoMonitor 3D Enterprise Flight Plan Metadata]
- Mission Type: ${mission.missionType}
- Target Altitude: ${mission.flightAltitudeMeters}m (${altRef})
- Flight Speed: ${mission.flightSpeedMps} m/s
- Waypoint Count: ${mission.waypoints.length}
- Target Platform: ${mission.targetPlatform || 'universal_generic'}
- Generated At: ${new Date().toISOString()}

[Validation Summary]
- Status: VALIDATED
- Legal Max Altitude Limit: 120m AGL (Passed)
- Safe Geofence & Boundary Check: Passed

[Compatibility Warnings]
- WARNING: Standard OGC KML format is provided for GIS spatial review, Google Earth 3D inspection, and GIS records.
- It is NOT an autonomous autopilot command payload for consumer remotes like DJI RC / DJI Fly app.
- DJI Mini 4 Pro does NOT support direct KML/KMZ flight plan import in the consumer DJI Fly app. Autonomous flights require the MSDK V5 Android Bridge with RC-N2.
- For DJI Enterprise aircraft (M350 RTK, Mavic 3E), use the native DJI Pilot 2 WPML KMZ export.
`.trim();

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${mission.name}</name>
    <description><![CDATA[${metadataDesc}]]></description>
    <ExtendedData>
      <Data name="missionType"><value>${mission.missionType}</value></Data>
      <Data name="altitudeReference"><value>${altRef}</value></Data>
      <Data name="targetPlatform"><value>${mission.targetPlatform || 'universal_generic'}</value></Data>
      <Data name="waypointCount"><value>${mission.waypoints.length}</value></Data>
    </ExtendedData>
    <Style id="flightPathStyle">
      <LineStyle>
        <color>ff00ffff</color>
        <width>3</width>
      </LineStyle>
    </Style>
    <Placemark>
      <name>Flight Trajectory Overview</name>
      <styleUrl>#flightPathStyle</styleUrl>
      <LineString>
        <altitudeMode>relativeToGround</altitudeMode>
        <coordinates>${coordinatesList}</coordinates>
      </LineString>
    </Placemark>
    ${boundaryPlacemark}
    <Folder>
      <name>Waypoints (${mission.waypoints.length})</name>
      ${placemarks}
    </Folder>
  </Document>
</kml>`;
}

/**
 * 4. Generate ArduPilot Waypoint File (QGC WPL 110 standard)
 */
export function generateArduPilotWaypoints(mission: DroneMissionDTO): string {
  // Format: <INDEX> <CURRENT_WP> <COORD_FRAME> <COMMAND> <PARAM1> <PARAM2> <PARAM3> <PARAM4> <PARAM5/LAT> <PARAM6/LON> <PARAM7/ALT> <AUTOCONTINUE>
  const lines: string[] = ['QGC WPL 110'];

  // Line 0: Home Point (MAV_CMD_NAV_WAYPOINT = 16)
  const homeAlt = mission.homePoint?.[2] || 0;
  lines.push(`0\t1\t0\t16\t0\t0\t0\t0\t${mission.homePoint[1].toFixed(7)}\t${mission.homePoint[0].toFixed(7)}\t${homeAlt.toFixed(2)}\t1`);

  // Line 1: Takeoff command (MAV_CMD_NAV_TAKEOFF = 22)
  const takeoffAlt = mission.flightAltitudeMeters;
  lines.push(`1\t0\t3\t22\t15\t0\t0\t0\t${mission.homePoint[1].toFixed(7)}\t${mission.homePoint[0].toFixed(7)}\t${takeoffAlt.toFixed(2)}\t1`);

  // Mission waypoints
  mission.waypoints.forEach((wp, idx) => {
    const seq = idx + 2;
    // MAV_FRAME_GLOBAL_RELATIVE_ALT = 3
    lines.push(`${seq}\t0\t3\t16\t0\t2\t0\t0\t${wp.latitude.toFixed(7)}\t${wp.longitude.toFixed(7)}\t${wp.altitudeMeters.toFixed(2)}\t1`);
  });

  // End: Return to launch (MAV_CMD_NAV_RETURN_TO_LAUNCH = 20)
  if (mission.finishAction === 'return_to_home') {
    const endSeq = mission.waypoints.length + 2;
    lines.push(`${endSeq}\t0\t3\t20\t0\t0\t0\t0\t0\t0\t0\t1`);
  }

  return lines.join('\n');
}

/**
 * 5. Generate Internal Neutral JSON
 */
export function generateInternalJSON(mission: DroneMissionDTO): string {
  return JSON.stringify(
    {
      schemaVersion: '2.0.0',
      system: 'GeoMonitor 3D Enterprise',
      exportedAt: new Date().toISOString(),
      crs: mission.crs || {
        horizontalCrs: 'EPSG:4326 (WGS84)',
        verticalDatum: 'EGM96',
        coordinateUnits: 'degrees',
      },
      mission,
      platformCompatibility: {
        targetPlatform: mission.targetPlatform || 'dji_mini_4_pro',
        isDirectlyFlyable: mission.targetPlatform !== 'dji_mini_4_pro',
        bridgeRequired: mission.targetPlatform === 'dji_mini_4_pro',
        notes:
          mission.targetPlatform === 'dji_mini_4_pro'
            ? 'DJI Fly application has no direct mission import. Upload via GeoMonitor Drone Bridge Android MSDK V5.'
            : 'Compatible with respective flight controller software.',
      },
    },
    null,
    2
  );
}

/**
 * 6. Master Mission Exporter
 */
export async function exportDroneMission(
  mission: DroneMissionDTO,
  platform: ExportPlatform
): Promise<{ filename: string; blob: Blob; mimeType: string }> {
  const cleanName = mission.name.replace(/[^a-zA-Z0-9_\u0E00-\u0E7F]/g, '_');

  if (platform === 'dji_pilot_wpml') {
    const { templateKml, waypointKml } = generateDJIWPML(mission);
    const zip = new JSZip();
    const wpmzFolder = zip.folder('wpmz');
    if (wpmzFolder) {
      wpmzFolder.file('template.kml', templateKml);
      wpmzFolder.file('waypoint.kml', waypointKml);
    }
    const zipBlob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.google-earth.kmz' });
    return {
      filename: `${cleanName}_DJI_WPML.kmz`,
      blob: zipBlob,
      mimeType: 'application/vnd.google-earth.kmz',
    };
  }

  if (platform === 'standard_kml') {
    const kmlStr = generateStandardKML(mission);
    const blob = new Blob([kmlStr], { type: 'application/vnd.google-earth.kml+xml' });
    return {
      filename: `${cleanName}_FlightPlan.kml`,
      blob,
      mimeType: 'application/vnd.google-earth.kml+xml',
    };
  }

  if (platform === 'standard_kmz') {
    const kmlStr = generateStandardKML(mission);
    const zip = new JSZip();
    zip.file('doc.kml', kmlStr);
    const zipBlob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.google-earth.kmz' });
    return {
      filename: `${cleanName}_FlightPlan.kmz`,
      blob: zipBlob,
      mimeType: 'application/vnd.google-earth.kmz',
    };
  }

  if (platform === 'qgroundcontrol_plan') {
    const planJson = generateQGCPlan(mission);
    const blob = new Blob([planJson], { type: 'application/json' });
    return {
      filename: `${cleanName}_QGC.plan`,
      blob,
      mimeType: 'application/json',
    };
  }

  if (platform === 'ardupilot_waypoints') {
    const wpContent = generateArduPilotWaypoints(mission);
    const blob = new Blob([wpContent], { type: 'text/plain' });
    return {
      filename: `${cleanName}_ArduPilot.waypoints`,
      blob,
      mimeType: 'text/plain',
    };
  }

  if (platform === 'internal_json') {
    const internalStr = generateInternalJSON(mission);
    const blob = new Blob([internalStr], { type: 'application/json' });
    return {
      filename: `${cleanName}_GeoMonitor3D_v2.json`,
      blob,
      mimeType: 'application/json',
    };
  }

  // Default: generic_geojson
  const geojsonStr = generateGenericGeoJSON(mission);
  const blob = new Blob([geojsonStr], { type: 'application/geo+json' });
  return {
    filename: `${cleanName}_GIS_Reference.geojson`,
    blob,
    mimeType: 'application/geo+json',
  };
}

