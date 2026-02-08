"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VcpDetector = void 0;
const client_1 = require("@prisma/client");
const primitives_1 = require("../../primitives");
class VcpDetector {
    type = client_1.SetupType.VCP;
    detect(bars, _swingPoints, context) {
        const completeBases = context.activeBases?.filter((b) => b.status === 'COMPLETE');
        if (!completeBases || completeBases.length === 0)
            return null;
        const base = completeBases[completeBases.length - 1];
        const baseStartIdx = bars.findIndex((b) => b.high >= base.peakPrice * 0.98);
        if (baseStartIdx < 0)
            return null;
        const baseBars = bars.slice(baseStartIdx);
        if (baseBars.length < 20)
            return null;
        const baseSwings = (0, primitives_1.detectSwingPoints)(baseBars, 5);
        const highs = baseSwings.filter((s) => s.type === 'HIGH');
        const lows = baseSwings.filter((s) => s.type === 'LOW');
        if (highs.length < 2 || lows.length < 2)
            return null;
        const cycles = [];
        const pairCount = Math.min(highs.length, lows.length);
        for (let i = 0; i < pairCount; i++) {
            const h = highs[i].price;
            const l = lows[i].price;
            cycles.push({ high: h, low: l, range: h - l });
        }
        if (cycles.length < 2)
            return null;
        let validContractions = 0;
        for (let i = 1; i < cycles.length; i++) {
            const prevRange = cycles[i - 1].range;
            const currRange = cycles[i].range;
            if (currRange >= prevRange * (1 / 3) &&
                currRange <= prevRange * (2 / 3)) {
                validContractions++;
            }
        }
        if (validContractions === 0)
            return null;
        const pivotPrice = cycles[cycles.length - 1].high;
        const stopPrice = cycles[cycles.length - 1].low;
        const riskPerShare = pivotPrice - stopPrice;
        const recentVolumes = baseBars.slice(-10).map((b) => b.volume);
        const earlyVolumes = baseBars.slice(0, 10).map((b) => b.volume);
        const avgRecent = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;
        const avgEarly = earlyVolumes.reduce((a, b) => a + b, 0) / earlyVolumes.length;
        const volumeDrying = avgRecent < avgEarly * 0.8;
        return {
            type: client_1.SetupType.VCP,
            direction: 'LONG',
            timeframe: 'DAILY',
            pivotPrice,
            stopPrice,
            targetPrice: riskPerShare > 0 ? pivotPrice + riskPerShare * 5 : undefined,
            riskReward: 5,
            metadata: {
                cycles: cycles.map((c) => ({
                    high: c.high,
                    low: c.low,
                    range: Math.round(c.range * 100) / 100,
                })),
                contractionRatio: cycles.length > 1
                    ? Math.round((cycles[cycles.length - 1].range / cycles[0].range) * 100) / 100
                    : null,
                volumeDrying,
                validContractions,
            },
            dailyBaseId: base.id,
        };
    }
}
exports.VcpDetector = VcpDetector;
//# sourceMappingURL=vcp.detector.js.map