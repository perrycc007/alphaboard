import { SetupScanAuditStatus } from '@prisma/client';
import {
  classifySetupAuditInput,
  setupAuditStatusFromDetection,
} from './setup-audit.service';

describe('setup audit classification', () => {
  it('keeps passing inputs as scan candidates', () => {
    const result = classifySetupAuditInput({
      stockId: 'stock-1',
      ticker: 'ABCD',
      latestClose: 12,
      avgVolume: 350_000,
      eligibleByScanFilter: true,
      minPrice: 5,
      minAvgVolume: 200_000,
    });

    expect(result.isCandidate).toBe(true);
    expect(result.scanStatus).toBe(SetupScanAuditStatus.CANDIDATE);
    expect(result.reasonCodes).toContain('PASSED_PREFILTER');
  });

  it('records concrete prefilter rejection reasons', () => {
    const result = classifySetupAuditInput({
      stockId: 'stock-2',
      ticker: 'THIN',
      latestClose: 3,
      avgVolume: 80_000,
      eligibleByScanFilter: false,
      minPrice: 5,
      minAvgVolume: 200_000,
    });

    expect(result.isCandidate).toBe(false);
    expect(result.scanStatus).toBe(SetupScanAuditStatus.INPUT_FILTERED);
    expect(result.reasonCodes).toEqual([
      'LOW_VOLUME',
      'LOW_PRICE',
      'NO_QUALIFYING_CONTEXT',
    ]);
  });

  it('prioritizes created, deduped, suppressed, then no-setup status', () => {
    expect(
      setupAuditStatusFromDetection({
        detectorSource: 'python',
        created: [{ type: 'VCP', direction: 'LONG', timeframe: 'DAILY' }],
        deduped: [],
        suppressed: [],
      }),
    ).toBe(SetupScanAuditStatus.DETECTED);

    expect(
      setupAuditStatusFromDetection({
        detectorSource: 'python',
        created: [],
        deduped: [{ type: 'VCP', direction: 'LONG', timeframe: 'DAILY' }],
        suppressed: [],
      }),
    ).toBe(SetupScanAuditStatus.DEDUPED);

    expect(
      setupAuditStatusFromDetection({
        detectorSource: 'typescript',
        created: [],
        deduped: [],
        suppressed: [{ type: 'DOUBLE_TOP', direction: 'SHORT', timeframe: 'DAILY' }],
      }),
    ).toBe(SetupScanAuditStatus.SUPPRESSED);

    expect(
      setupAuditStatusFromDetection({
        detectorSource: 'typescript',
        created: [],
        deduped: [],
        suppressed: [],
      }),
    ).toBe(SetupScanAuditStatus.NO_SETUP);
  });
});
