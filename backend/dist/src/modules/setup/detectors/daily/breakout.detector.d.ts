import { Bar } from '../../../../common/types';
import { SwingPointResult } from '../../primitives';
import { DailyDetector, DailyDetectorContext, DetectedSetup } from '../detector.interface';
export declare class BreakoutDetector implements DailyDetector {
    type: "BREAKOUT_PIVOT";
    detect(bars: Bar[], _swingPoints: SwingPointResult[], context: DailyDetectorContext): DetectedSetup | null;
}
