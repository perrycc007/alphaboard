import { Bar } from '../../../../common/types';
import { IntradayDetector, DailyDetectorContext, DetectedSetup } from '../detector.interface';
export declare class TiringDownDetector implements IntradayDetector {
    type: "TIRING_DOWN";
    detect(bars: Bar[], _dailyContext: DailyDetectorContext): DetectedSetup | null;
}
