import { CameraParameters } from '@geomonitor/shared';
import { CameraFootprintBox } from './types';
import { LocalEnuProjector, toRadians } from './mission-geometry-engine';

export interface FootprintCalculationResult {
  gsdCmPerPixel: number;
  groundCoverageWidthMeters: number;
  groundCoverageHeightMeters: number;
  flightLineSpacingMeters: number;
  photoTriggerDistanceMeters: number;
  photoIntervalSeconds: number;
}

/**
 * Camera Footprint and Photogrammetry Parameter Calculator
 */
export class CameraFootprintCalculator {
  /**
   * Calculate ground sampling distance, footprint, and spacing
   */
  static calculate(
    altitudeMeters: number,
    camera: CameraParameters,
    flightSpeedMps = 8,
    gimbalPitchDeg = -90
  ): FootprintCalculationResult {
    const H = Math.max(altitudeMeters, 5.0);
    const Sw = camera.sensorWidthMm;
    const Sh = camera.sensorHeightMm;
    const F = camera.focalLengthMm;
    const Iw = camera.imageWidthPx;
    const Ih = camera.imageHeightPx;

    // GSD (Ground Sampling Distance in cm/pixel)
    const gsdW = ((H * Sw) / (F * Iw)) * 100;
    const gsdH = ((H * Sh) / (F * Ih)) * 100;
    const gsdCmPerPixel = Math.max(gsdW, gsdH);

    // Ground footprint dimensions for nadir view (meters)
    let groundCoverageWidthMeters = (H * Sw) / F;
    let groundCoverageHeightMeters = (H * Sh) / F;

    // Adjust along-track footprint if gimbal is pitched for oblique survey (e.g. -65 deg)
    const pitchOffsetDeg = Math.abs(-90 - gimbalPitchDeg);
    if (pitchOffsetDeg > 5) {
      const pitchRad = toRadians(pitchOffsetDeg);
      const cosPitch = Math.cos(pitchRad);
      if (cosPitch > 0.2) {
        // Oblique extension on ground
        groundCoverageHeightMeters = groundCoverageHeightMeters / (cosPitch * cosPitch);
      }
    }

    // Line spacing across-track based on side overlap
    const sideOverlapFrac = Math.min(Math.max(camera.sideOverlapPercent / 100, 0.1), 0.95);
    const flightLineSpacingMeters = Math.max(
      groundCoverageWidthMeters * (1 - sideOverlapFrac),
      5.0
    );

    // Photo trigger distance along-track based on forward overlap
    const forwardOverlapFrac = Math.min(Math.max(camera.forwardOverlapPercent / 100, 0.1), 0.95);
    const photoTriggerDistanceMeters = Math.max(
      groundCoverageHeightMeters * (1 - forwardOverlapFrac),
      3.0
    );

    const speed = Math.max(flightSpeedMps, 1.0);
    const photoIntervalSeconds = photoTriggerDistanceMeters / speed;

    return {
      gsdCmPerPixel: Number(gsdCmPerPixel.toFixed(2)),
      groundCoverageWidthMeters: Number(groundCoverageWidthMeters.toFixed(1)),
      groundCoverageHeightMeters: Number(groundCoverageHeightMeters.toFixed(1)),
      flightLineSpacingMeters: Number(flightLineSpacingMeters.toFixed(1)),
      photoTriggerDistanceMeters: Number(photoTriggerDistanceMeters.toFixed(1)),
      photoIntervalSeconds: Number(photoIntervalSeconds.toFixed(1)),
    };
  }

  /**
   * Compute 4 ground corner coordinates of camera footprint at a given position & heading
   */
  static computeFootprintBox(
    lon: number,
    lat: number,
    altitudeMeters: number,
    camera: CameraParameters,
    headingDeg: number,
    gimbalPitchDeg = -90
  ): CameraFootprintBox {
    const params = this.calculate(altitudeMeters, camera, 8, gimbalPitchDeg);
    const halfW = params.groundCoverageWidthMeters / 2;
    const halfH = params.groundCoverageHeightMeters / 2;

    const proj = new LocalEnuProjector(lon, lat);
    const rad = toRadians(headingDeg);
    const cosH = Math.cos(rad);
    const sinH = Math.sin(rad);

    // 4 local corners relative to center [dx, dy]
    const localCorners: [number, number][] = [
      [-halfW, halfH], // Front-Left
      [halfW, halfH], // Front-Right
      [halfW, -halfH], // Back-Right
      [-halfW, -halfH], // Back-Left
    ];

    const corners: [number, number][] = localCorners.map(([dx, dy]) => {
      // Rotate by heading
      const rx = dx * cosH + dy * sinH;
      const ry = -dx * sinH + dy * cosH;
      return proj.inverse(rx, ry);
    });

    return {
      center: [lon, lat],
      corners,
      widthMeters: params.groundCoverageWidthMeters,
      heightMeters: params.groundCoverageHeightMeters,
    };
  }
}
