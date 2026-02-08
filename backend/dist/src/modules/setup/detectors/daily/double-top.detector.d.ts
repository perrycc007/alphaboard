import { Bar } from '../../../../common/types';
import { SwingPointResult } from '../../primitives';
import { DailyDetector, DailyDetectorContext, DetectedSetup } from '../detector.interface';
export declare class DoubleTopDetector implements DailyDetector {
    type: "DOUBLE_TOP";
    detect(bars: Bar[], swingPoints: SwingPointResult[], _context: DailyDetectorContext): DetectedSetup | null;
}
