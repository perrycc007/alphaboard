import { Bar } from '../../../common/types';
import { VolumeStateType } from '../primitives';
export interface BarEvidenceResult {
    pattern: string;
    bias: 'BULLISH' | 'BEARISH';
    isViolation: boolean;
    keyLevelType: string;
    keyLevelPrice: number;
    volumeState: VolumeStateType;
}
export interface BarContext {
    swingPoints: Array<{
        type: string;
        price: number;
    }>;
    bases: Array<{
        peakPrice: number;
        baseLow: number;
        pivotPrice?: number | null;
    }>;
    indicators: {
        sma20?: number;
        sma50?: number;
        sma200?: number;
        vwap?: number;
    };
    avgVolume: number;
    avgRange: number;
}
export declare function evaluateBar(bar: Bar, prevBar: Bar, context: BarContext): BarEvidenceResult[];
