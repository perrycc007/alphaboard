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
export declare function calculatePositionSize(accountEquity: number, riskPercent: number, entryPrice: number, stopPrice: number): PositionSizeResult;
export declare function suggestStopLevels(setupLow: number, atr14: number): StopLevels;
export declare class RiskEngineService {
    calculate(accountEquity: number, riskPercent: number, entryPrice: number, stopPrice: number): PositionSizeResult;
    stopLevels(setupLow: number, atr14: number): StopLevels;
}
