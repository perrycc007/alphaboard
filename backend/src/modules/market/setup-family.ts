import { SetupFamily, SetupType } from '@prisma/client';

const REVERSAL_TYPES = new Set<SetupType>([
  SetupType.UNDERCUT_RALLY,
  SetupType.DOUBLE_TOP,
]);

const TREND_LONG_TYPES = new Set<SetupType>([
  SetupType.VCP,
  SetupType.BREAKOUT_PIVOT,
  SetupType.BREAKOUT_VCB,
  SetupType.BREAKOUT_WEDGE,
  SetupType.HIGH_TIGHT_FLAG,
  SetupType.PULLBACK_BUY,
  SetupType.EMA20_PULLBACK,
]);

const TREND_SHORT_TYPES = new Set<SetupType>([
  SetupType.FAIL_BASE,
  SetupType.FAIL_BREAKOUT,
  SetupType.MA_RALLY_FAILURE,
  SetupType.EMA200_KEY_LEVEL,
  SetupType.DOUBLE_TOP,
]);

export function getSetupFamily(type: SetupType): SetupFamily | null {
  if (REVERSAL_TYPES.has(type)) return SetupFamily.REVERSAL;
  if (TREND_LONG_TYPES.has(type)) return SetupFamily.TREND_LONG;
  if (TREND_SHORT_TYPES.has(type)) return SetupFamily.TREND_SHORT;
  return null;
}

export function getTrendBias(type: SetupType): 'LONG' | 'SHORT' | 'REVERSAL' | null {
  if (REVERSAL_TYPES.has(type)) return 'REVERSAL';
  if (TREND_LONG_TYPES.has(type)) return 'LONG';
  if (TREND_SHORT_TYPES.has(type)) return 'SHORT';
  return null;
}
