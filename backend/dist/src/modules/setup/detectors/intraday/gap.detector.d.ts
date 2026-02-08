import { Bar } from '../../../../common/types';
import { IntradayDetector, DailyDetectorContext, DetectedSetup } from '../detector.interface';
export declare class GapDetector implements IntradayDetector {
    type: "GAP_UP";
    detect(bars: Bar[], _dailyContext: DailyDetectorContext): DetectedSetup | null;
}
