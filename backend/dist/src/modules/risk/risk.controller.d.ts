import { RiskEngineService } from './risk-engine.service';
export declare class RiskController {
    private readonly riskEngine;
    constructor(riskEngine: RiskEngineService);
    calculate(body: {
        accountEquity: number;
        riskPercent: number;
        entryPrice: number;
        stopPrice: number;
    }): import("./risk-engine.service").PositionSizeResult;
    stopLevels(body: {
        setupLow: number;
        atr14: number;
    }): import("./risk-engine.service").StopLevels;
}
