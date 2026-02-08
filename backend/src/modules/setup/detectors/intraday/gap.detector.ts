import { SetupType } from '@prisma/client';
import { Bar } from '../../../../common/types';
import { averageBarSize } from '../../primitives';
import {
  IntradayDetector,
  DailyDetectorContext,
  DetectedSetup,
} from '../detector.interface';

/**
 * Gap Detector
 * Identifies gap up/down at or near key levels (Swing High/Low).
 * Runs at market open.
 */
export class GapDetector implements IntradayDetector {
  type = SetupType.GAP_UP; // Will be overridden per detection

  detect(
    bars: Bar[],
    _dailyContext: DailyDetectorContext,
  ): DetectedSetup | null {
    if (bars.length < 2) return null;

    const prevBar = bars[bars.length - 2];
    const currBar = bars[bars.length - 1];
    const abs = averageBarSize(bars);

    const gapUp = currBar.open > prevBar.high + abs * 0.5;
    const gapDown = currBar.open < prevBar.low - abs * 0.5;

    if (!gapUp && !gapDown) return null;

    const gapSize = gapUp
      ? currBar.open - prevBar.high
      : prevBar.low - currBar.open;

    const gapPercent = gapSize / prevBar.close;

    // Only signal meaningful gaps (> 1%)
    if (gapPercent < 0.01) return null;

    return {
      type: gapUp ? SetupType.GAP_UP : SetupType.GAP_DOWN,
      direction: gapUp ? 'LONG' : 'SHORT',
      timeframe: 'INTRADAY',
      pivotPrice: currBar.open,
      evidence: [gapUp ? 'gap_up' : 'gap_down'],
      waitingFor: '620_cross',
      metadata: {
        gapSize: Math.round(gapSize * 100) / 100,
        gapPercent: Math.round(gapPercent * 10000) / 100,
        prevClose: prevBar.close,
        openPrice: currBar.open,
      },
    };
  }
}
