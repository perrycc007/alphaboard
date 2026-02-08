import { Bar } from '../../../../common/types';
import { SwingPointResult } from '../../primitives';
import { DailyDetector, DailyDetectorContext, DetectedSetup } from '../detector.interface';
export declare class FailBreakoutDetector implements DailyDetector {
    type: "FAIL_BREAKOUT";
    detect(bars: Bar[], _swingPoints: SwingPointResult[], context: DailyDetectorContext): DetectedSetup | null;
}
