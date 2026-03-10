"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntradayUndercutRallyDetector = void 0;
const client_1 = require("@prisma/client");
const primitives_1 = require("../../primitives");
class IntradayUndercutRallyDetector {
    type = client_1.SetupType.UNDERCUT_RALLY;
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
        const swingLows = swingPoints.filter((p) => p.type === 'LOW');
        if (swingLows.length === 0)
            return null;
        const undercutTol = 0.1 * atr;
        const nearAtr = 0.3;
        for (let k = swingLows.length - 1; k >= 0; k--) {
            const priorLow = swingLows[k];
            const hasHighBefore = swingPoints.some((p) => p.type === 'HIGH' && p.index < priorLow.index);
            const hasHighAfter = swingPoints.some((p) => p.type === 'HIGH' && p.index > priorLow.index);
            if (!hasHighBefore || !hasHighAfter)
                continue;
            const barsAfter = bars.length - 1 - priorLow.index;
            if (barsAfter < 3)
                continue;
            const hasUndercut = latestBar.low < priorLow.price - undercutTol;
            const nearDistance = Math.abs(latestBar.low - priorLow.price);
            const isNear = nearDistance <= nearAtr * atr;
            if (!hasUndercut && !isNear)
                continue;
            if (hasUndercut && latestBar.high > priorLow.price) {
                const stopPrice = latestBar.low - 0.5 * atr;
                const risk = priorLow.price - stopPrice;
                return {
                    type: client_1.SetupType.UNDERCUT_RALLY,
                    direction: 'LONG',
                    timeframe: 'INTRADAY',
                    pivotPrice: priorLow.price,
                    stopPrice,
                    targetPrice: risk > 0 ? priorLow.price + risk * 3 : undefined,
                    riskReward: 3,
                    evidence: ['intraday_undercut', 'intrabar_reclaim'],
                    metadata: {
                        priorLowPrice: priorLow.price,
                        undercutLow: latestBar.low,
                        reclaimHigh: latestBar.high,
                        atrUsed: atr,
                        state: 'TRIGGERED',
                    },
                };
            }
            if (hasUndercut) {
                return {
                    type: client_1.SetupType.UNDERCUT_RALLY,
                    direction: 'LONG',
                    timeframe: 'INTRADAY',
                    pivotPrice: priorLow.price,
                    stopPrice: latestBar.low - 0.5 * atr,
                    evidence: ['intraday_undercut'],
                    waitingFor: 'intrabar_reclaim',
                    metadata: {
                        priorLowPrice: priorLow.price,
                        undercutLow: latestBar.low,
                        atrUsed: atr,
                        state: 'READY',
                    },
                };
            }
            return {
                type: client_1.SetupType.UNDERCUT_RALLY,
                direction: 'LONG',
                timeframe: 'INTRADAY',
                pivotPrice: priorLow.price,
                stopPrice: priorLow.price - 0.5 * atr,
                evidence: ['intraday_approaching_prior_low'],
                waitingFor: 'undercut_below_prior_low',
                metadata: {
                    priorLowPrice: priorLow.price,
                    nearCrossDistance: nearDistance,
                    atrUsed: atr,
                    state: 'BUILDING',
                },
            };
        }
        return null;
    }
}
exports.IntradayUndercutRallyDetector = IntradayUndercutRallyDetector;
//# sourceMappingURL=intraday-undercut-rally.detector.js.map