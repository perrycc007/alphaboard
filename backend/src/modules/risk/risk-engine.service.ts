import { Injectable } from '@nestjs/common';

export interface PositionSizeResult {
  shares: number;
  riskAmount: number;
  positionValue: number;
}

export interface StopLevels {
  tight: number;
  normal: number;
  wide: number;
}

/**
 * Pure calculation: position size from risk parameters.
 * Stop = Setup Low + buffer (ATR-based)
 * Position size = risk amount / per-share risk
 */
export function calculatePositionSize(
  accountEquity: number,
  riskPercent: number,
  entryPrice: number,
  stopPrice: number,
): PositionSizeResult {
  const riskAmount = accountEquity * (riskPercent / 100);
  const perShareRisk = Math.abs(entryPrice - stopPrice);

  if (perShareRisk === 0) {
    return { shares: 0, riskAmount, positionValue: 0 };
  }

  const shares = Math.floor(riskAmount / perShareRisk);
  const positionValue = shares * entryPrice;

  return { shares, riskAmount, positionValue };
}

/**
 * Pure calculation: suggest stop levels based on setup low and ATR.
 * tight = setupLow - 0.5*ATR
 * normal = setupLow - 1*ATR
 * wide = setupLow - 1.5*ATR
 */
export function suggestStopLevels(
  setupLow: number,
  atr14: number,
): StopLevels {
  return {
    tight: Math.round((setupLow - 0.5 * atr14) * 100) / 100,
    normal: Math.round((setupLow - 1 * atr14) * 100) / 100,
    wide: Math.round((setupLow - 1.5 * atr14) * 100) / 100,
  };
}

@Injectable()
export class RiskEngineService {
  calculate(
    accountEquity: number,
    riskPercent: number,
    entryPrice: number,
    stopPrice: number,
  ): PositionSizeResult {
    return calculatePositionSize(
      accountEquity,
      riskPercent,
      entryPrice,
      stopPrice,
    );
  }

  stopLevels(setupLow: number, atr14: number): StopLevels {
    return suggestStopLevels(setupLow, atr14);
  }
}
