"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiskEngineService = void 0;
exports.calculatePositionSize = calculatePositionSize;
exports.suggestStopLevels = suggestStopLevels;
const common_1 = require("@nestjs/common");
function calculatePositionSize(accountEquity, riskPercent, entryPrice, stopPrice) {
    const riskAmount = accountEquity * (riskPercent / 100);
    const perShareRisk = Math.abs(entryPrice - stopPrice);
    if (perShareRisk === 0) {
        return { shares: 0, riskAmount, positionValue: 0 };
    }
    const shares = Math.floor(riskAmount / perShareRisk);
    const positionValue = shares * entryPrice;
    return { shares, riskAmount, positionValue };
}
function suggestStopLevels(setupLow, atr14) {
    return {
        tight: Math.round((setupLow - 0.5 * atr14) * 100) / 100,
        normal: Math.round((setupLow - 1 * atr14) * 100) / 100,
        wide: Math.round((setupLow - 1.5 * atr14) * 100) / 100,
    };
}
let RiskEngineService = class RiskEngineService {
    calculate(accountEquity, riskPercent, entryPrice, stopPrice) {
        return calculatePositionSize(accountEquity, riskPercent, entryPrice, stopPrice);
    }
    stopLevels(setupLow, atr14) {
        return suggestStopLevels(setupLow, atr14);
    }
};
exports.RiskEngineService = RiskEngineService;
exports.RiskEngineService = RiskEngineService = __decorate([
    (0, common_1.Injectable)()
], RiskEngineService);
//# sourceMappingURL=risk-engine.service.js.map