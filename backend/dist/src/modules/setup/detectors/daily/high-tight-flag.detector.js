"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HighTightFlagDetector = void 0;
const client_1 = require("@prisma/client");
const primitives_1 = require("../../primitives");
class HighTightFlagDetector {
    type = client_1.SetupType.HIGH_TIGHT_FLAG;
    detect(bars, _swingPoints, context) {
        if (!context.isStage2)
            return null;
        if (bars.length < 42)
            return null;
        const recent = bars.slice(-42);
        const startPrice = recent[0].close;
        const peak = Math.max(...recent.map((b) => b.high));
        if (peak < startPrice * 2)
            return null;
        const latestBar = bars[bars.length - 1];
        const retrace = (peak - latestBar.close) / peak;
        if (retrace > 0.2)
            return null;
        const pivotPct = ((peak - latestBar.close) / latestBar.close) * 100;
        if (pivotPct > 5)
            return null;
        const peakIndex = recent.findIndex((b) => b.high === peak);
        const advanceBars = recent.slice(0, peakIndex + 1);
        const retraceBars = recent.slice(peakIndex + 1);
        if (retraceBars.length === 0)
            return null;
        const advanceAvgVol = advanceBars.reduce((sum, b) => sum + b.volume, 0) / advanceBars.length;
        const retraceAvgVol = retraceBars.reduce((sum, b) => sum + b.volume, 0) / retraceBars.length;
        if (advanceAvgVol <= 0)
            return null;
        if (retraceAvgVol > advanceAvgVol * 0.6)
            return null;
        const abs = (0, primitives_1.averageBarSize)(bars);
        const stopPrice = latestBar.low - abs;
        const riskPerShare = latestBar.close - stopPrice;
        return {
            type: client_1.SetupType.HIGH_TIGHT_FLAG,
            direction: 'LONG',
            timeframe: 'DAILY',
            pivotPrice: peak,
            stopPrice,
            targetPrice: riskPerShare > 0 ? latestBar.close + riskPerShare * 5 : undefined,
            riskReward: 5,
            evidence: ['100pct_rise', 'tight_retrace', 'volume_contraction'],
            metadata: {
                risePercent: Math.round(((peak - startPrice) / startPrice) * 100),
                retracePct: Math.round(retrace * 100),
                advanceAvgVol: Math.round(advanceAvgVol),
                retraceAvgVol: Math.round(retraceAvgVol),
                volContractionPct: Math.round((1 - retraceAvgVol / advanceAvgVol) * 100),
            },
        };
    }
}
exports.HighTightFlagDetector = HighTightFlagDetector;
//# sourceMappingURL=high-tight-flag.detector.js.map