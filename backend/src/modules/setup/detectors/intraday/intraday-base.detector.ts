import { SetupType } from '@prisma/client';
import { Bar } from '../../../../common/types';
import { averageBarSize, detectFractalPivots } from '../../primitives';
import {
  IntradayDetector,
  DailyDetectorContext,
  DetectedSetup,
} from '../detector.interface';

/**
 * Intraday Base Detector (ref: setup-detector.md section 3)
 *
 * Find intraday Swing High or Swing Low.
 * Scan next X bars (15-30): no break beyond peak +/- buffer, no 620 cross.
 * Range contraction = optional strengthener.
 * State: BUILDING while forming, READY when duration met.
 */
export class IntradayBaseDetector implements IntradayDetector {
  type = SetupType.INTRADAY_BASE;

  detect(
    bars: Bar[],
    _dailyContext: DailyDetectorContext,
  ): DetectedSetup | null {
    if (bars.length < 15) return null;

    const abs = averageBarSize(bars);
    const swings = detectFractalPivots(bars, 5);

    if (swings.length === 0) return null;

    const lastSwing = swings[swings.length - 1];
    const barsAfter = bars.slice(lastSwing.index);

    if (barsAfter.length < 10) return null;

    // Check no break beyond the swing point +/- buffer
    const isHigh = lastSwing.type === 'HIGH';
    const level = lastSwing.price;
    const buffer = abs * 0.5;

    let structureIntact = true;
    for (const bar of barsAfter) {
      if (isHigh && bar.high > level + buffer) {
        structureIntact = false;
        break;
      }
      if (!isHigh && bar.low < level - buffer) {
        structureIntact = false;
        break;
      }
    }

    if (!structureIntact) return null;

    const direction = isHigh ? 'SHORT' : 'LONG';
    const stopPrice = isHigh ? level + abs : level - abs;

    return {
      type: SetupType.INTRADAY_BASE,
      direction,
      timeframe: 'INTRADAY',
      pivotPrice: level,
      stopPrice,
      evidence: ['intraday_base_forming'],
      waitingFor: '620_cross',
      metadata: {
        swingType: lastSwing.type,
        swingPrice: level,
        barsInBase: barsAfter.length,
      },
    };
  }

  updateState(
    currentState: string,
    _latestBar: Bar,
    _context: DailyDetectorContext,
  ): string {
    // State transitions happen in the orchestrator based on 620 cross
    return currentState;
  }
}
