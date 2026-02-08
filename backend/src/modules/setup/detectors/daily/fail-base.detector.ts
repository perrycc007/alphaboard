import { SetupType } from '@prisma/client';
import { Bar } from '../../../../common/types';
import { SwingPointResult, averageBarSize } from '../../primitives';
import {
  DailyDetector,
  DailyDetectorContext,
  DetectedSetup,
} from '../detector.interface';

/**
 * Fail Base Detector (ref: fail-break-fail-base.md section 2)
 *
 * Pre-condition: a VCP was detected (BUILDING or READY state)
 * Detects structural failure: Close < 50MA
 * Confirmation: 2 consecutive closes below 50MA, or single close with distance > 0.5 * ABS
 * High-severity signal: triggers stage downgrade consideration
 */
export class FailBaseDetector implements DailyDetector {
  type = SetupType.FAIL_BASE;

  detect(
    bars: Bar[],
    _swingPoints: SwingPointResult[],
    context: DailyDetectorContext,
  ): DetectedSetup | null {
    if (bars.length < 3) return null;
    if (!context.sma50) return null;

    // Must have active VCP in BUILDING or READY state
    const activeVcp = context.activeSetups?.find(
      (s) =>
        s.type === SetupType.VCP &&
        (s.state === 'BUILDING' || s.state === 'READY'),
    );

    if (!activeVcp) return null;

    const sma50 = context.sma50;
    const abs = averageBarSize(bars);
    const latestBar = bars[bars.length - 1];
    const prevBar = bars[bars.length - 2];

    if (latestBar.close >= sma50) return null;

    const distanceBelow = sma50 - latestBar.close;
    const twoConsecutive = prevBar.close < sma50 && latestBar.close < sma50;
    const singleStrong = distanceBelow > 0.5 * abs;

    if (!twoConsecutive && !singleStrong) return null;

    return {
      type: SetupType.FAIL_BASE,
      direction: 'SHORT',
      timeframe: 'DAILY',
      pivotPrice: sma50,
      stopPrice: sma50 + abs,
      evidence: [
        twoConsecutive ? 'two_consecutive_below_50ma' : 'strong_close_below_50ma',
      ],
      metadata: {
        sma50,
        failureClose: latestBar.close,
        distanceBelow: Math.round(distanceBelow * 100) / 100,
        vcpSetupId: activeVcp.id,
      },
    };
  }
}
