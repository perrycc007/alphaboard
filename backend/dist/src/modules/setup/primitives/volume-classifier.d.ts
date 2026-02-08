export type VolumeStateType = 'EXPANSION' | 'CONTRACTION' | 'NORMAL';
export declare function classifyVolume(currentVolume: number, avgVolume: number, expansionK?: number, contractionM?: number): VolumeStateType;
