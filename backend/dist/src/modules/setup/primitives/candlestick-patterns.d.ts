import { Bar } from '../../../common/types';
export declare function isDryUp(bar: Bar, avgRange: number, avgVolume: number): boolean;
export declare function isWickAbsorption(bar: Bar, bias: 'BULLISH' | 'BEARISH'): boolean;
export declare function isEngulfing(current: Bar, previous: Bar): 'BULLISH' | 'BEARISH' | null;
