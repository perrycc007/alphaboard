"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TiringDownDetector = void 0;
const client_1 = require("@prisma/client");
const primitives_1 = require("../../primitives");
class TiringDownDetector {
    type = client_1.SetupType.TIRING_DOWN;
    detect(bars, _dailyContext) {
        if (bars.length < 30)
            return null;
        const evidence = [];
        const lookback = 15;
        const recentBars = bars.slice(-lookback);
        const priorBars = bars.slice(-(lookback * 2), -lookback);
        const recentHighs = [];
        for (let i = 1; i < recentBars.length; i++) {
            if (recentBars[i].high > recentBars[i - 1].high) {
                recentHighs.push(recentBars[i].high - recentBars[i - 1].high);
            }
        }
        if (recentHighs.length >= 3) {
            let decreasingDeltas = 0;
            for (let i = 1; i < recentHighs.length; i++) {
                if (recentHighs[i] < recentHighs[i - 1])
                    decreasingDeltas++;
            }
            if (decreasingDeltas >= (recentHighs.length - 1) * 0.6) {
                evidence.push('momentum_decay');
            }
        }
        const gapSeries = (0, primitives_1.emaGapSeries)(bars, 6, 20);
        if (gapSeries.length >= lookback) {
            const converging = (0, primitives_1.isConverging)(gapSeries, lookback);
            const lastGap = gapSeries[gapSeries.length - 1];
            if (converging && lastGap > 0) {
                evidence.push('ema_compression');
            }
        }
        const histogram = (0, primitives_1.macdHistogram)(bars, 6, 20, 9);
        if (histogram.length >= lookback) {
            const contracting = (0, primitives_1.isHistogramContracting)(histogram, lookback);
            const lastHist = histogram[histogram.length - 1];
            if (contracting && lastHist > 0) {
                evidence.push('macd_contraction');
            }
        }
        if (priorBars.length > 0) {
            const priorEfficiency = (0, primitives_1.priceEfficiency)(priorBars);
            const recentEfficiency = (0, primitives_1.priceEfficiency)(recentBars);
            if (recentEfficiency < priorEfficiency * 0.7) {
                evidence.push('efficiency_decline');
            }
        }
        if (evidence.length < 3)
            return null;
        return {
            type: client_1.SetupType.TIRING_DOWN,
            direction: 'SHORT',
            timeframe: 'INTRADAY',
            evidence,
            waitingFor: '620_cross',
            metadata: {
                score: evidence.length,
                signals: evidence,
            },
        };
    }
}
exports.TiringDownDetector = TiringDownDetector;
//# sourceMappingURL=tiring-down.detector.js.map