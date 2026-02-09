"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MaTouchDetector = void 0;
const client_1 = require("@prisma/client");
const primitives_1 = require("../../primitives");
class MaTouchDetector {
    type = client_1.SetupType.MA_TOUCH;
    detect(bars, _swingPoints, context) {
        if (bars.length < 3)
            return null;
        const latestBar = bars[bars.length - 1];
        const prevBar = bars[bars.length - 2];
        const prev2Bar = bars[bars.length - 3];
        const abs = (0, primitives_1.averageBarSize)(bars);
        const mas = [
            { value: context.ema20, name: 'EMA20' },
            { value: context.sma50, name: 'SMA50' },
            { value: context.sma200, name: 'SMA200' },
        ].filter((ma) => ma.value != null);
        for (const ma of mas) {
            const maValue = ma.value;
            const touchesMA = latestBar.low <= maValue && maValue <= latestBar.high;
            if (!touchesMA)
                continue;
            const wasAbove = prevBar.close > maValue && prev2Bar.close > maValue;
            if (wasAbove) {
                const stopPrice = latestBar.low - abs;
                const riskPerShare = latestBar.close - stopPrice;
                return {
                    type: client_1.SetupType.MA_TOUCH,
                    direction: 'LONG',
                    timeframe: 'DAILY',
                    pivotPrice: maValue,
                    stopPrice,
                    targetPrice: riskPerShare > 0 ? latestBar.close + riskPerShare * 3 : undefined,
                    riskReward: 3,
                    evidence: [`${ma.name}_touch_support`],
                    metadata: {
                        maType: ma.name,
                        maValue,
                        touchLow: latestBar.low,
                        touchHigh: latestBar.high,
                        touchClose: latestBar.close,
                    },
                };
            }
            const wasBelow = prevBar.close < maValue && prev2Bar.close < maValue;
            if (wasBelow) {
                const stopPrice = latestBar.high + abs;
                const riskPerShare = stopPrice - latestBar.close;
                return {
                    type: client_1.SetupType.MA_TOUCH,
                    direction: 'SHORT',
                    timeframe: 'DAILY',
                    pivotPrice: maValue,
                    stopPrice,
                    targetPrice: riskPerShare > 0 ? latestBar.close - riskPerShare * 3 : undefined,
                    riskReward: 3,
                    evidence: [`${ma.name}_touch_resistance`],
                    metadata: {
                        maType: ma.name,
                        maValue,
                        touchLow: latestBar.low,
                        touchHigh: latestBar.high,
                        touchClose: latestBar.close,
                    },
                };
            }
        }
        return null;
    }
}
exports.MaTouchDetector = MaTouchDetector;
//# sourceMappingURL=ma-touch.detector.js.map