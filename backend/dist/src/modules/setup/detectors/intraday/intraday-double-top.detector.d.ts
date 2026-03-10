import { Bar } from '../../../../common/types';
import { IntradayDetector, DailyDetectorContext, DetectedSetup } from '../detector.interface';
export declare class IntradayDoubleTopDetector implements IntradayDetector {
    type: "DOUBLE_TOP";
    detect(bars: Bar[], dailyContext: DailyDetectorContext): DetectedSetup | null;
}
