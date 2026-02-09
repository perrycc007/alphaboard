"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UndercutRallyDetector = void 0;
const client_1 = require("@prisma/client");
const primitives_1 = require("../../primitives");
class UndercutRallyDetector {
    type = client_1.SetupType.UNDERCUT_RALLY;
    detect(bars, swingPoints, context) {
        if (bars.length < 20)
            return null;
        const swingLows = swingPoints.filter((p) => p.type === 'LOW');
        if (swingLows.length < 2)
            return null;
        const abs = (0, primitives_1.averageBarSize)(bars);
        const atr = context.atr14 ?? abs;
        const latestBar = bars[bars.length - 1];
        const targetLow = swingLows[swingLows.length - 1];
        const hasHighBefore = swingPoints.some((p) => p.type === 'HIGH' && p.index < targetLow.index);
        if (!hasHighBefore)
            return null;
        const hasHighAfter = swingPoints.some((p) => p.type === 'HIGH' && p.index > targetLow.index);
        if (!hasHighAfter)
            return null;
        const sigLookEnd = Math.min(targetLow.index + 11, bars.length);
        let isSignificant = false;
        for (let j = targetLow.index + 1; j < sigLookEnd; j++) {
            if (bars[j].low > targetLow.price + 2.5 * atr) {
                isSignificant = true;
                break;
            }
        }
        if (!isSignificant)
            return null;
        const recentStart = Math.max(0, bars.length - 7);
        let wasFarAbove = false;
        for (let j = recentStart; j < bars.length - 1; j++) {
            if (bars[j].low > targetLow.price + 2.5 * atr) {
                wasFarAbove = true;
                break;
            }
        }
        if (!wasFarAbove)
            return null;
        const nowNearLow = latestBar.low <= targetLow.price + 1 * atr;
        if (!nowNearLow)
            return null;
        const distFromLow = Math.abs(latestBar.low - targetLow.price);
        if (distFromLow > abs)
            return null;
        if (latestBar.close <= targetLow.price)
            return null;
        const stopPrice = targetLow.price - abs;
        const riskPerShare = latestBar.close - stopPrice;
        return {
            type: client_1.SetupType.UNDERCUT_RALLY,
            direction: 'LONG',
            timeframe: 'DAILY',
            pivotPrice: targetLow.price,
            stopPrice,
            targetPrice: riskPerShare > 0 ? latestBar.close + riskPerShare * 3 : undefined,
            riskReward: 3,
            evidence: ['significant_swing_low', 'sudden_drop', 'support_held'],
            metadata: {
                swingLowPrice: targetLow.price,
                testLow: latestBar.low,
                holdClose: latestBar.close,
                atrUsed: atr,
            },
        };
    }
}
exports.UndercutRallyDetector = UndercutRallyDetector;
//# sourceMappingURL=undercut-rally.detector.js.map