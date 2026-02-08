import { Bar } from '../../../common/types';
import { KeyLevel } from './key-level.resolver';
import { VolumeStateType } from '../primitives';
export interface ViolationResult {
    pattern: string;
    bias: 'BULLISH' | 'BEARISH';
    keyLevelType: string;
    keyLevelPrice: number;
}
export declare function evaluateViolation(bar: Bar, level: KeyLevel, volumeState: VolumeStateType, avgRange: number): ViolationResult | null;
