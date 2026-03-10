"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectMarketRegime = detectMarketRegime;
const price_efficiency_1 = require("./price-efficiency");
const ema_gap_1 = require("./ema-gap");
function detectMarketRegime(input) {
    const { bars, ema20, sma50, sma200, atr14, activeSetups } = input;
    if (bars.length < 5)
        return 'CHOP';
    const atr = atr14 ?? 0;
    const recentBars = bars.slice(-30);
    const eff30 = (0, price_efficiency_1.priceEfficiency)(recentBars);
    if (eff30 < 0.25)
        return 'CHOP';
    if (ema20 != null && sma50 != null && sma200 != null && atr > 0) {
        const vals = [ema20, sma50, sma200];
        const spread = Math.max(...vals) - Math.min(...vals);
        if (spread < atr)
            return 'CHOP';
    }
    if (sma200 != null && recentBars.length >= 2) {
        let crossCount = 0;
        for (let i = 1; i < recentBars.length; i++) {
            const prevAbove = recentBars[i - 1].close > sma200;
            const currAbove = recentBars[i].close > sma200;
            if (prevAbove !== currAbove)
                crossCount++;
        }
        if (crossCount >= 3)
            return 'CHOP';
    }
    const hasFailBase = activeSetups?.some((s) => s.type === 'FAIL_BASE' && s.state === 'TRIGGERED');
    if (hasFailBase)
        return 'FAILURE';
    if (sma50 != null &&
        ema20 != null &&
        bars[bars.length - 1].close < sma50 &&
        ema20 < sma50) {
        return 'FAILURE';
    }
    let trendSignals = 0;
    const eff20 = (0, price_efficiency_1.priceEfficiency)(bars.slice(-20));
    if (eff20 > 0.4)
        trendSignals++;
    if (sma50 != null && bars.length >= 10) {
        const recent = bars[bars.length - 1].close;
        const older = bars[bars.length - 10].close;
        if (recent > older && recent > sma50)
            trendSignals++;
    }
    if (ema20 != null && sma50 != null && ema20 > sma50)
        trendSignals++;
    if (bars.length >= 20) {
        const gap = (0, ema_gap_1.emaGapSeries)(bars, 20, 50);
        if (gap.length >= 10 && !(0, ema_gap_1.isConverging)(gap, 10))
            trendSignals++;
    }
    if (trendSignals >= 2)
        return 'TREND';
    return 'CHOP';
}
//# sourceMappingURL=market-regime.js.map