import { Bar } from '../../../common/types';
export declare function macdHistogram(bars: Bar[], fast?: number, slow?: number, signal?: number): number[];
export declare function isHistogramContracting(histogram: number[], lookback: number): boolean;
