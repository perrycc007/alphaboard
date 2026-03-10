import { Bar } from '../../../common/types';
export interface SwingPointResult {
    index: number;
    price: number;
    type: 'HIGH' | 'LOW';
    atr: number;
    prominence: number;
}
export declare function detectFractalPivots(bars: Bar[], lookahead?: number): SwingPointResult[];
export interface SwingDetectOpts {
    left?: number;
    right?: number;
    atrPeriod?: number;
    promAtr?: number;
    departAtr?: number;
    departLookahead?: number;
    minSwingSep?: number;
}
export declare function detectSignificantSwingPoints(bars: Bar[], opts?: SwingDetectOpts): SwingPointResult[];
