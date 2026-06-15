import { summarizeEffectivenessRows } from './strategy-effectiveness.service';

describe('summarizeEffectivenessRows', () => {
  it('separates working and failing setup families from outcome rows', () => {
    const stats = summarizeEffectivenessRows([
      { setupType: 'VCP', maxR: 4, finalR: 2, targetHit: true },
      { setupType: 'VCP', maxR: 3, finalR: 1.2, targetHit: true },
      { setupType: 'VCP', maxR: 2, finalR: 0.8 },
      { setupType: 'UNDERCUT_RALLY', maxR: 0.4, finalR: -1, stoppedOut: true },
      { setupType: 'UNDERCUT_RALLY', maxR: 0.7, finalR: -0.5, setupViolated: true },
    ]);

    expect(stats.VCP.sampleCount).toBe(3);
    expect(stats.VCP.avgFinalR).toBeGreaterThan(1);
    expect(stats.VCP.score).toBeGreaterThan(stats.UNDERCUT_RALLY.score);
    expect(stats.UNDERCUT_RALLY.stopRate).toBe(1);
  });
});
