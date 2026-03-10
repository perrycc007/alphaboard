import { Bar } from '../../../../common/types';
import { IntradayDetector, DailyDetectorContext, DetectedSetup } from '../detector.interface';
export declare class IntradayUndercutRallyDetector implements IntradayDetector {
    type: "UNDERCUT_RALLY";
    detect(bars: Bar[], dailyContext: DailyDetectorContext): DetectedSetup | null;
}
