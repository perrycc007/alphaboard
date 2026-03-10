"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DoubleTopDetector = void 0;
const client_1 = require("@prisma/client");
class DoubleTopDetector {
    type = client_1.SetupType.DOUBLE_TOP;
    detect(bars, swingPoints, context) {
        if (bars.length < 20)
            return null;
        const atr = context.atr14 ?? 0;
        if (atr <= 0)
            return null;
        const latestBar = bars[bars.length - 1];
        const swingHighs = swingPoints.filter((p) => p.type === 'HIGH');
        if (swingHighs.length === 0)
            return null;
        const pullbackAtr = 2.5;
        const minBarsSince = 10;
        const breakTol = 0.1 * atr;
        const nearAtr = 0.5;
        for (let k = swingHighs.length - 1; k >= 0; k--) {
            const top1 = swingHighs[k];
            const barsAfterTop1 = bars.length - 1 - top1.index;
            if (barsAfterTop1 < minBarsSince)
                continue;
            let pullbackLow = Infinity;
            for (let j = top1.index + 1; j < bars.length; j++) {
                if (bars[j].low < pullbackLow)
                    pullbackLow = bars[j].low;
            }
            const pullbackDepth = top1.price - pullbackLow;
            if (pullbackDepth < pullbackAtr * atr)
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
                const riskPerShare = stopPrice - top1.price;
                return {
                    type: client_1.SetupType.DOUBLE_TOP,
                    direction: 'SHORT',
                    timeframe: 'DAILY',
                    pivotPrice: top1.price,
                    stopPrice,
                    targetPrice: riskPerShare > 0 ? top1.price - riskPerShare * 3 : undefined,
                    riskReward: 3,
                    evidence: [
                        'significant_swing_high',
                        'pullback_depth_ok',
                        'upthrust_intrabar_failure',
                    ],
                    metadata: {
                        top1Price: top1.price,
                        top1Index: top1.index,
                        top2High: latestBar.high,
                        pullbackLow,
                        pullbackDepthAtr: Math.round((pullbackDepth / atr) * 100) / 100,
                        atrUsed: atr,
                        state: 'TRIGGERED',
                    },
                };
            }
            if (hasExceeded) {
                const stopPrice = latestBar.high + 0.5 * atr;
                const riskPerShare = stopPrice - top1.price;
                return {
                    type: client_1.SetupType.DOUBLE_TOP,
                    direction: 'SHORT',
                    timeframe: 'DAILY',
                    pivotPrice: top1.price,
                    stopPrice,
                    targetPrice: riskPerShare > 0 ? top1.price - riskPerShare * 3 : undefined,
                    riskReward: 3,
                    evidence: [
                        'significant_swing_high',
                        'pullback_depth_ok',
                        'top2_exceeded_top1',
                    ],
                    waitingFor: 'intrabar_failure_below_top1',
                    metadata: {
                        top1Price: top1.price,
                        top1Index: top1.index,
                        top2High: latestBar.high,
                        pullbackLow,
                        pullbackDepthAtr: Math.round((pullbackDepth / atr) * 100) / 100,
                        atrUsed: atr,
                        state: 'READY',
                    },
                };
            }
            return {
                type: client_1.SetupType.DOUBLE_TOP,
                direction: 'SHORT',
                timeframe: 'DAILY',
                pivotPrice: top1.price,
                stopPrice: top1.price + 0.5 * atr,
                evidence: [
                    'significant_swing_high',
                    'pullback_depth_ok',
                    'approaching_top1',
                ],
                waitingFor: 'price_exceeds_top1',
                metadata: {
                    top1Price: top1.price,
                    top1Index: top1.index,
                    nearCrossDistance: nearDistance,
                    pullbackLow,
                    pullbackDepthAtr: Math.round((pullbackDepth / atr) * 100) / 100,
                    atrUsed: atr,
                    state: 'BUILDING',
                },
            };
        }
        return null;
    }
}
exports.DoubleTopDetector = DoubleTopDetector;
//# sourceMappingURL=double-top.detector.js.map