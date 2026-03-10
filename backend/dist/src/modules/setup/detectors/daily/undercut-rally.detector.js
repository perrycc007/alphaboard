"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UndercutRallyDetector = void 0;
const client_1 = require("@prisma/client");
class UndercutRallyDetector {
    type = client_1.SetupType.UNDERCUT_RALLY;
    detect(bars, swingPoints, context) {
        if (bars.length < 20)
            return null;
        const atr = context.atr14 ?? 0;
        if (atr <= 0)
            return null;
        const latestBar = bars[bars.length - 1];
        const swingLows = swingPoints.filter((p) => p.type === 'LOW');
        if (swingLows.length === 0)
            return null;
        const undercutTol = 0.2 * atr;
        const nearAtr = 0.5;
        for (let k = swingLows.length - 1; k >= 0; k--) {
            const priorLow = swingLows[k];
            const hasHighBefore = swingPoints.some((p) => p.type === 'HIGH' && p.index < priorLow.index);
            const hasHighAfter = swingPoints.some((p) => p.type === 'HIGH' && p.index > priorLow.index);
            if (!hasHighBefore || !hasHighAfter)
                continue;
            const barsAfter = bars.length - 1 - priorLow.index;
            if (barsAfter < 5)
                continue;
            const hasUndercut = latestBar.low < priorLow.price - undercutTol;
            const nearDistance = Math.abs(latestBar.low - priorLow.price);
            const isNear = nearDistance <= nearAtr * atr;
            if (!hasUndercut && !isNear)
                continue;
            if (hasUndercut && latestBar.high > priorLow.price) {
                const undercutLow = latestBar.low;
                const stopPrice = undercutLow - 0.5 * atr;
                const riskPerShare = priorLow.price - stopPrice;
                return {
                    type: client_1.SetupType.UNDERCUT_RALLY,
                    direction: 'LONG',
                    timeframe: 'DAILY',
                    pivotPrice: priorLow.price,
                    stopPrice,
                    targetPrice: riskPerShare > 0 ? priorLow.price + riskPerShare * 3 : undefined,
                    riskReward: 3,
                    evidence: [
                        'significant_swing_low',
                        'undercut_below_prior_low',
                        'intrabar_reclaim',
                    ],
                    metadata: {
                        priorLowPrice: priorLow.price,
                        priorLowIndex: priorLow.index,
                        undercutLow,
                        reclaimHigh: latestBar.high,
                        atrUsed: atr,
                        state: 'TRIGGERED',
                    },
                };
            }
            if (hasUndercut) {
                const stopPrice = latestBar.low - 0.5 * atr;
                const riskPerShare = priorLow.price - stopPrice;
                return {
                    type: client_1.SetupType.UNDERCUT_RALLY,
                    direction: 'LONG',
                    timeframe: 'DAILY',
                    pivotPrice: priorLow.price,
                    stopPrice,
                    targetPrice: riskPerShare > 0 ? priorLow.price + riskPerShare * 3 : undefined,
                    riskReward: 3,
                    evidence: [
                        'significant_swing_low',
                        'undercut_below_prior_low',
                    ],
                    waitingFor: 'intrabar_reclaim_above_prior_low',
                    metadata: {
                        priorLowPrice: priorLow.price,
                        priorLowIndex: priorLow.index,
                        undercutLow: latestBar.low,
                        atrUsed: atr,
                        state: 'READY',
                    },
                };
            }
            return {
                type: client_1.SetupType.UNDERCUT_RALLY,
                direction: 'LONG',
                timeframe: 'DAILY',
                pivotPrice: priorLow.price,
                stopPrice: priorLow.price - 0.5 * atr,
                evidence: [
                    'significant_swing_low',
                    'approaching_prior_low',
                ],
                waitingFor: 'undercut_below_prior_low',
                metadata: {
                    priorLowPrice: priorLow.price,
                    priorLowIndex: priorLow.index,
                    nearCrossDistance: nearDistance,
                    atrUsed: atr,
                    state: 'BUILDING',
                },
            };
        }
        return null;
    }
}
exports.UndercutRallyDetector = UndercutRallyDetector;
//# sourceMappingURL=undercut-rally.detector.js.map