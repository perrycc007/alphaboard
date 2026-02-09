"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DoubleTopDetector = void 0;
const client_1 = require("@prisma/client");
const primitives_1 = require("../../primitives");
class DoubleTopDetector {
    type = client_1.SetupType.DOUBLE_TOP;
    detect(bars, swingPoints, context) {
        if (!context.isStage2)
            return null;
        if (bars.length < 20)
            return null;
        const swingHighs = swingPoints.filter((p) => p.type === 'HIGH');
        if (swingHighs.length < 2)
            return null;
        const abs = (0, primitives_1.averageBarSize)(bars);
        const atr = context.atr14 ?? abs;
        const latestBar = bars[bars.length - 1];
        const targetHigh = swingHighs[swingHighs.length - 1];
        const sigLookEnd = Math.min(targetHigh.index + 11, bars.length);
        let isSignificant = false;
        for (let j = targetHigh.index + 1; j < sigLookEnd; j++) {
            if (bars[j].high < targetHigh.price - 2.5 * atr) {
                isSignificant = true;
                break;
            }
        }
        if (!isSignificant)
            return null;
        const recentStart = Math.max(0, bars.length - 7);
        let wasFarBelow = false;
        for (let j = recentStart; j < bars.length - 1; j++) {
            if (bars[j].high < targetHigh.price - 2.5 * atr) {
                wasFarBelow = true;
                break;
            }
        }
        if (!wasFarBelow)
            return null;
        const nowNearHigh = latestBar.high >= targetHigh.price - 1 * atr;
        if (!nowNearHigh)
            return null;
        const distFromHigh = Math.abs(latestBar.high - targetHigh.price);
        if (distFromHigh > abs)
            return null;
        if (latestBar.close >= targetHigh.price)
            return null;
        const stopPrice = targetHigh.price + abs;
        const riskPerShare = stopPrice - latestBar.close;
        return {
            type: client_1.SetupType.DOUBLE_TOP,
            direction: 'SHORT',
            timeframe: 'DAILY',
            pivotPrice: targetHigh.price,
            stopPrice,
            targetPrice: riskPerShare > 0 ? latestBar.close - riskPerShare * 3 : undefined,
            riskReward: 3,
            evidence: ['significant_swing_high', 'sudden_rise', 'failed_test_of_high'],
            metadata: {
                swingHighPrice: targetHigh.price,
                testHigh: latestBar.high,
                rejectionClose: latestBar.close,
                atrUsed: atr,
            },
        };
    }
}
exports.DoubleTopDetector = DoubleTopDetector;
//# sourceMappingURL=double-top.detector.js.map