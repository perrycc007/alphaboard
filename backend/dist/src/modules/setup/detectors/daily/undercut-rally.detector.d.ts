import { Bar } from '../../../../common/types';
import { SwingPointResult } from '../../primitives';
import { DailyDetector, DailyDetectorContext, DetectedSetup } from '../detector.interface';
export declare class UndercutRallyDetector implements DailyDetector {
    type: "UNDERCUT_RALLY";
    detect(bars: Bar[], swingPoints: SwingPointResult[], context: DailyDetectorContext): DetectedSetup | null;
}
