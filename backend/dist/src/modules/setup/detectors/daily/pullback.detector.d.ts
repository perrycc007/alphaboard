import { Bar } from '../../../../common/types';
import { SwingPointResult } from '../../primitives';
import { DailyDetector, DailyDetectorContext, DetectedSetup } from '../detector.interface';
export declare class PullbackDetector implements DailyDetector {
    type: "PULLBACK_BUY";
    detect(bars: Bar[], _swingPoints: SwingPointResult[], context: DailyDetectorContext): DetectedSetup | null;
}
