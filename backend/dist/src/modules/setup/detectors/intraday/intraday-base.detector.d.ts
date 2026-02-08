import { Bar } from '../../../../common/types';
import { IntradayDetector, DailyDetectorContext, DetectedSetup } from '../detector.interface';
export declare class IntradayBaseDetector implements IntradayDetector {
    type: "INTRADAY_BASE";
    detect(bars: Bar[], _dailyContext: DailyDetectorContext): DetectedSetup | null;
    updateState(currentState: string, _latestBar: Bar, _context: DailyDetectorContext): string;
}
