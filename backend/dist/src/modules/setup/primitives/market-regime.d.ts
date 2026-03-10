import { Bar } from '../../../common/types';
export type MarketRegime = 'TREND' | 'FAILURE' | 'CHOP';
export interface MarketRegimeInput {
    bars: Bar[];
    ema20?: number;
    sma50?: number;
    sma200?: number;
    atr14?: number;
    activeSetups?: Array<{
        type: string;
        state: string;
    }>;
}
export declare function detectMarketRegime(input: MarketRegimeInput): MarketRegime;
