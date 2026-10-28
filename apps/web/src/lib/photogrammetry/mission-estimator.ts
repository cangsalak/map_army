import { PhotogrammetryEstimates } from '@geomonitor/shared';
import { FlightLineSegment, PhotoCapturePosition, TransitionPath } from './types';

export interface MissionEstimationDetails extends PhotogrammetryEstimates {
  turnCount: number;
  averageLineLengthMeters: number;
  turnTimeSeconds: number;
  shutterTimeSeconds: number;
  surveyFlightTimeSeconds: number;
  transitFlightTimeSeconds: number;
  batteryMinutesPerPack: number;
  assumptions: string[];
}

/**
 * MissionEstimator
 * Accurately models flight distance, realistic flight duration with deceleration turns
 * and camera shutter cycles, safe battery consumption, and coverage metrics.
 */
export class MissionEstimator {
  static estimate(params: {
    flightLines: FlightLineSegment[];
    photoPositions: PhotoCapturePosition[];
    transitionPaths: TransitionPath[];
    totalFlightDistanceMeters: number;
    flightSpeedMps?: number;
    transitSpeedMps?: number;
    turnStrategy?: string;
    triggerMode?: 'distance_interval' | 'time_interval' | 'stop_and_shoot';
    batteryMinutesPerPack?: number;
    gsdCmPerPixel: number;
    groundCoverageWidthMeters: number;
    groundCoverageHeightMeters: number;
    flightLineSpacingMeters: number;
    photoTriggerDistanceMeters: number;
  }): MissionEstimationDetails {
    const {
      flightLines,
      photoPositions,
      transitionPaths,
      totalFlightDistanceMeters,
      flightSpeedMps = 8,
      transitSpeedMps = 12,
      turnStrategy = 'stop_and_turn',
      triggerMode = 'distance_interval',
      batteryMinutesPerPack = 22, // 22 minutes safe operational threshold (leaving 20-25% RTH reserve)
      gsdCmPerPixel,
      groundCoverageWidthMeters,
      groundCoverageHeightMeters,
      flightLineSpacingMeters,
      photoTriggerDistanceMeters,
    } = params;

    // Survey distance (along lines)
    let surveyDistanceMeters = 0;
    for (const line of flightLines) {
      surveyDistanceMeters += line.lengthMeters;
    }

    // Transit distance (home to first line, last line to home, and turns)
    const transitDistanceMeters = Math.max(0, totalFlightDistanceMeters - surveyDistanceMeters);

    // Turn overhead per transition
    // 'stop_and_turn' typically requires 4-5s for deceleration, yaw, acceleration
    // 'bank_turn' or 'adaptive_curve' takes ~2-3s
    const secondsPerTurn =
      turnStrategy === 'stop_and_turn' ? 4.5 : turnStrategy === 'adaptive_curve' ? 2.5 : 3.5;
    const turnCount = transitionPaths.length;
    const turnTimeSeconds = Math.round(turnCount * secondsPerTurn);

    // Shutter pause overhead: if continuous flight with high-speed shutter ~0.2s, if stop_and_shoot ~2.5s
    const secondsPerShutter = triggerMode === 'stop_and_shoot' ? 2.5 : 0.2;
    const shutterTimeSeconds = Math.round(photoPositions.length * secondsPerShutter);

    // Cruise flight times
    const surveyFlightTimeSeconds = Math.round(surveyDistanceMeters / Math.max(flightSpeedMps, 1.0));
    const transitFlightTimeSeconds = Math.round(transitDistanceMeters / Math.max(transitSpeedMps, 1.0));

    // Total realistic flight time
    const estimatedFlightTimeSeconds =
      surveyFlightTimeSeconds + transitFlightTimeSeconds + turnTimeSeconds + shutterTimeSeconds;

    // Number of batteries required (conservative calculation)
    const safeOperationalSeconds = batteryMinutesPerPack * 60;
    const batteryCountNeeded = Math.max(1, Math.ceil(estimatedFlightTimeSeconds / safeOperationalSeconds));

    const averageLineLengthMeters =
      flightLines.length > 0 ? Math.round(surveyDistanceMeters / flightLines.length) : 0;

    return {
      gsdCmPerPixel,
      groundCoverageWidthMeters,
      groundCoverageHeightMeters,
      flightLineSpacingMeters,
      photoTriggerDistanceMeters,
      estimatedPhotoCount: photoPositions.length,
      estimatedFlightDistanceMeters: Math.round(totalFlightDistanceMeters),
      estimatedFlightTimeSeconds,
      batteryCountNeeded,
      turnCount,
      averageLineLengthMeters,
      turnTimeSeconds,
      shutterTimeSeconds,
      surveyFlightTimeSeconds,
      transitFlightTimeSeconds,
      batteryMinutesPerPack,
      assumptions: [
        `ความเร็วแนวสำรวจ: ${flightSpeedMps} m/s, ความเร็วเดินทาง: ${transitSpeedMps} m/s`,
        `เวลาชะลอเลี้ยว: ${secondsPerTurn}s/แนวบิน (${turnStrategy})`,
        `เวลาเสถียรชัตเตอร์: ${secondsPerShutter}s/ภาพ (${triggerMode})`,
        `ความปลอดภัยแบตเตอรี่: จำกัด ${batteryMinutesPerPack} นาที/ก้อน (สำรอง 20% เพื่อ RTH)`,
        'เวลาจริงอาจคลาดเคลื่อนตามความเร็วลม สภาพอากาศ และระดับความสูงของภูมิประเทศ',
      ],
    };
  }
}
