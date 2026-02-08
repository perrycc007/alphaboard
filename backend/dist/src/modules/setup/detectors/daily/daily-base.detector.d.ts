import { Bar } from '../../../../common/types';
import { SwingPointResult } from '../../primitives';
import { DailyDetector, DailyDetectorContext, DetectedSetup } from '../detector.interface';
export declare class DailyBaseDetector implements DailyDetector {
    type: "BREAKOUT_PIVOT";
    detect(bars: Bar[], swingPoints: SwingPointResult[], context: DailyDetectorContext): DetectedSetup | null;
}
