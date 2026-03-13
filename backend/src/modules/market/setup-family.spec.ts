import { SetupFamily, SetupType } from '@prisma/client';
import { getSetupFamily } from './setup-family';

describe('getSetupFamily', () => {
  it('maps reversal setups correctly', () => {
    expect(getSetupFamily(SetupType.UNDERCUT_RALLY)).toBe(SetupFamily.REVERSAL);
    expect(getSetupFamily(SetupType.DOUBLE_TOP)).toBe(SetupFamily.REVERSAL);
  });

  it('maps trend-long setups correctly', () => {
    expect(getSetupFamily(SetupType.BREAKOUT_PIVOT)).toBe(SetupFamily.TREND_LONG);
    expect(getSetupFamily(SetupType.PULLBACK_BUY)).toBe(SetupFamily.TREND_LONG);
  });

  it('maps trend-short setups correctly', () => {
    expect(getSetupFamily(SetupType.FAIL_BASE)).toBe(SetupFamily.TREND_SHORT);
    expect(getSetupFamily(SetupType.MA_RALLY_FAILURE)).toBe(SetupFamily.TREND_SHORT);
  });
});
