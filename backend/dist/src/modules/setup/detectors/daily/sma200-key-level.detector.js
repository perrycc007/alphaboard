"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Sma200KeyLevelDetector = void 0;
class Sma200KeyLevelDetector {
    type = 'EMA200_KEY_LEVEL';
    detect(bars, _swingPoints, context) {
        if (bars.length < 30)
            return null;
        if (context.regime === 'CHOP')
            return null;
        const atr = context.atr14 ?? 0;
        if (atr <= 0)
            return null;
        const sma200 = context.sma200;
        if (sma200 == null)
            return null;
        const latestBar = bars[bars.length - 1];
        const recentBars = bars.slice(-30);
        let crossCount = 0;
        for (let i = 1; i < recentBars.length; i++) {
            const prevAbove = recentBars[i - 1].close > sma200;
            const currAbove = recentBars[i].close > sma200;
            if (prevAbove !== currAbove)
                crossCount++;
        }
        if (crossCount >= 3)
            return null;
        let maxDeparture = 0;
        for (const b of bars) {
            const dep = Math.abs(b.close - sma200);
            if (dep > maxDeparture)
                maxDeparture = dep;
        }
        if (maxDeparture < 3 * atr)
            return null;
        const touchesSma200 = latestBar.low <= sma200 && sma200 <= latestBar.high;
        if (!touchesSma200)
            return null;
        const slopeUp = bars.length >= 10 &&
            bars[bars.length - 1].close > bars[bars.length - 10].close;
        const direction = slopeUp ? 'LONG' : 'SHORT';
        const stopBuffer = 1 * atr;
        const stopPrice = direction === 'LONG'
            ? sma200 - stopBuffer
            : sma200 + stopBuffer;
        const riskPerShare = Math.abs(latestBar.close - stopPrice);
        return {
            type: 'EMA200_KEY_LEVEL',
            direction,
            timeframe: 'DAILY',
            pivotPrice: sma200,
            stopPrice,
            targetPrice: riskPerShare > 0
                ? direction === 'LONG'
                    ? latestBar.close + riskPerShare * 3
                    : latestBar.close - riskPerShare * 3
                : undefined,
            riskReward: 3,
            evidence: [
                'meaningful_departure',
                'sma200_touch',
                `direction_${direction.toLowerCase()}`,
            ],
            metadata: {
                context: 'MEANINGFUL_DEPARTURE',
                sma200,
                departureATR: Math.round((maxDeparture / atr) * 100) / 100,
                crossCount,
                slopeUp,
                regime: context.regime,
                atrUsed: atr,
            },
        };
    }
}
exports.Sma200KeyLevelDetector = Sma200KeyLevelDetector;
//# sourceMappingURL=sma200-key-level.detector.js.map