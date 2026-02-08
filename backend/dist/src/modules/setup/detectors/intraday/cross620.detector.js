"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Cross620Detector = void 0;
const client_1 = require("@prisma/client");
class Cross620Detector {
    type = client_1.SetupType.CROSS_620;
    detect(bars, context) {
        if (bars.length < 2)
            return null;
        const waiting = context.activeSetups?.find((s) => s.state === 'READY' || s.state === 'BUILDING');
        if (!waiting)
            return null;
        const prev = bars[bars.length - 2];
        const curr = bars[bars.length - 1];
        const recentCloses = bars.slice(-20).map((b) => b.close);
        if (recentCloses.length < 20)
            return null;
        const ema6Curr = this.sma(recentCloses.slice(-6));
        const ema20Curr = this.sma(recentCloses);
        const ema6Prev = this.sma(recentCloses.slice(-7, -1));
        const ema20Prev = this.sma(recentCloses.slice(0, -1));
        const prevBelow = ema6Prev < ema20Prev;
        const currAbove = ema6Curr > ema20Curr;
        const prevAbove = ema6Prev > ema20Prev;
        const currBelow = ema6Curr < ema20Curr;
        const bullishCross = prevBelow && currAbove;
        const bearishCross = prevAbove && currBelow;
        if (!bullishCross && !bearishCross)
            return null;
        return {
            type: client_1.SetupType.CROSS_620,
            direction: bullishCross ? 'LONG' : 'SHORT',
            timeframe: 'INTRADAY',
            pivotPrice: curr.close,
            evidence: [bullishCross ? 'bullish_620_cross' : 'bearish_620_cross'],
            metadata: {
                ema6: ema6Curr,
                ema20: ema20Curr,
                triggerPrice: curr.close,
            },
        };
    }
    sma(values) {
        return values.reduce((a, b) => a + b, 0) / values.length;
    }
}
exports.Cross620Detector = Cross620Detector;
//# sourceMappingURL=cross620.detector.js.map