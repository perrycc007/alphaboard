export type VolumeStateType = 'EXPANSION' | 'CONTRACTION' | 'NORMAL';

/**
 * Classify volume state relative to average.
 * EXPANSION: volume > expansionK * avgVolume (default 1.5x)
 * CONTRACTION: volume < contractionM * avgVolume (default 0.6x)
 * NORMAL: in between
 */
export function classifyVolume(
  currentVolume: number,
  avgVolume: number,
  expansionK = 1.5,
  contractionM = 0.6,
): VolumeStateType {
  if (avgVolume === 0) return 'NORMAL';
  const ratio = currentVolume / avgVolume;
  if (ratio > expansionK) return 'EXPANSION';
  if (ratio < contractionM) return 'CONTRACTION';
  return 'NORMAL';
}
