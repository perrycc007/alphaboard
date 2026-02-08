import { Bar } from '../../../common/types';
export interface SwingPointResult {
    index: number;
    price: number;
    type: 'HIGH' | 'LOW';
    absValue: number;
}
export declare function detectSwingPoints(bars: Bar[], lookahead?: number): SwingPointResult[];
