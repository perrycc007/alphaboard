import { Bar } from '../../../../common/types';
import { SwingPointResult } from '../../primitives';
import { DailyDetector, DailyDetectorContext, DetectedSetup } from '../detector.interface';
export declare class MomentumContinuationDetector implements DailyDetector {
    type: "MOMENTUM_CONTINUATION";
    detect(bars: Bar[], _swingPoints: SwingPointResult[], context: DailyDetectorContext): DetectedSetup | null;
}
