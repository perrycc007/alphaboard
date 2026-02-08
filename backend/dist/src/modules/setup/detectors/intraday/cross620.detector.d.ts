import { Bar } from '../../../../common/types';
import { IntradayDetector, DailyDetectorContext, DetectedSetup } from '../detector.interface';
export declare class Cross620Detector implements IntradayDetector {
    type: "CROSS_620";
    detect(bars: Bar[], context: DailyDetectorContext): DetectedSetup | null;
    private sma;
}
