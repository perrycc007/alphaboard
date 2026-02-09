import { Bar } from '../../../../common/types';
import { SwingPointResult } from '../../primitives';
import { DailyDetector, DailyDetectorContext, DetectedSetup } from '../detector.interface';
export declare class MaTouchDetector implements DailyDetector {
    type: "MA_TOUCH";
    detect(bars: Bar[], _swingPoints: SwingPointResult[], context: DailyDetectorContext): DetectedSetup | null;
}
