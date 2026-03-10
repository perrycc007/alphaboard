"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntradayDoubleTopDetector = void 0;
const client_1 = require("@prisma/client");
const primitives_1 = require("../../primitives");
class IntradayDoubleTopDetector {
    type = client_1.SetupType.DOUBLE_TOP;
    detect(bars, dailyContext) {
        if (bars.length < 15)
            return null;
        const atr = dailyContext.atr14 ?? 0;
        if (atr <= 0)
            return null;
        const latestBar = bars[bars.length - 1];
        const swingPoints = (0, primitives_1.detectSignificantSwingPoints)(bars, {
            left: 2,
            right: 2,
            promAtr: 1.0,
            departAtr: 1.5,
            departLookahead: 7,
            minSwingSep: 5,
        });
        const swingHighs = swingPoints.filter((p) => p.type === 'HIGH');
        if (swingHighs.length === 0)
            return null;
        const breakTol = 0.05 * atr;
        const nearAtr = 0.3;
        const pullbackAtr = 1.5;
        for (let k = swingHighs.length - 1; k >= 0; k--) {
            const top1 = swingHighs[k];
            const barsAfter = bars.length - 1 - top1.index;
            if (barsAfter < 5)
                continue;
            let pullbackLow = Infinity;
            for (let j = top1.index + 1; j < bars.length; j++) {
                if (bars[j].low < pullbackLow)
                    pullbackLow = bars[j].low;
            }
            if (top1.price - pullbackLow < pullbackAtr * atr)
                continue;
            const hasLowBetween = swingPoints.some((p) => p.type === 'LOW' && p.index > top1.index);
            if (!hasLowBetween)
                continue;
            const nearDistance = Math.abs(latestBar.high - top1.price);
            const isNear = nearDistance <= nearAtr * atr;
            const hasExceeded = latestBar.high > top1.price + breakTol;
            if (!isNear && !hasExceeded)
                continue;
            if (hasExceeded && latestBar.low < top1.price) {
                const stopPrice = latestBar.high + 0.5 * atr;
                const risk = stopPrice - top1.price;
                return {
                    type: client_1.SetupType.DOUBLE_TOP,
                    direction: 'SHORT',
                    timeframe: 'INTRADAY',
                    pivotPrice: top1.price,
                    stopPrice,
                    targetPrice: risk > 0 ? top1.price - risk * 3 : undefined,
                    riskReward: 3,
                    evidence: ['intraday_upthrust', 'intrabar_failure'],
                    metadata: {
                        top1Price: top1.price,
                        top2High: latestBar.high,
                        pullbackLow,
                        atrUsed: atr,
                        state: 'TRIGGERED',
                    },
                };
            }
            if (hasExceeded) {
                return {
                    type: client_1.SetupType.DOUBLE_TOP,
                    direction: 'SHORT',
                    timeframe: 'INTRADAY',
                    pivotPrice: top1.price,
                    stopPrice: latestBar.high + 0.5 * atr,
                    evidence: ['intraday_upthrust', 'top2_exceeded'],
                    waitingFor: 'intrabar_failure_below_top1',
                    metadata: {
                        top1Price: top1.price,
                        top2High: latestBar.high,
                        atrUsed: atr,
                        state: 'READY',
                    },
                };
            }
            return {
                type: client_1.SetupType.DOUBLE_TOP,
                direction: 'SHORT',
                timeframe: 'INTRADAY',
                pivotPrice: top1.price,
                stopPrice: top1.price + 0.5 * atr,
                evidence: ['intraday_approaching_top1'],
                waitingFor: 'price_exceeds_top1',
                metadata: {
                    top1Price: top1.price,
                    nearCrossDistance: nearDistance,
                    atrUsed: atr,
                    state: 'BUILDING',
                },
            };
        }
        return null;
    }
}
exports.IntradayDoubleTopDetector = IntradayDoubleTopDetector;
//# sourceMappingURL=intraday-double-top.detector.js.map