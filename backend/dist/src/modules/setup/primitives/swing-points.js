"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectFractalPivots = detectFractalPivots;
exports.detectSignificantSwingPoints = detectSignificantSwingPoints;
const average_bar_size_1 = require("./average-bar-size");
const atr_1 = require("./atr");
function detectFractalPivots(bars, lookahead = 10) {
    if (bars.length < lookahead + 1)
        return [];
    const abs = (0, average_bar_size_1.averageBarSize)(bars);
    const atrValues = (0, atr_1.atrSeries)(bars);
    const points = [];
    for (let t = 0; t <= bars.length - lookahead - 1; t++) {
        const h0 = bars[t].high;
        const l0 = bars[t].low;
        const a = Number.isFinite(atrValues[t]) ? atrValues[t] : abs;
        let isSwingHigh = true;
        for (let i = t + 1; i <= t + lookahead; i++) {
            if (bars[i].high >= h0 - abs) {
                isSwingHigh = false;
                break;
            }
        }
        if (isSwingHigh) {
            points.push({ index: t, price: h0, type: 'HIGH', atr: a, prominence: 0 });
        }
        let isSwingLow = true;
        for (let i = t + 1; i <= t + lookahead; i++) {
            if (bars[i].low <= l0 + abs) {
                isSwingLow = false;
                break;
            }
        }
        if (isSwingLow) {
            points.push({ index: t, price: l0, type: 'LOW', atr: a, prominence: 0 });
        }
    }
    return points;
}
function detectSignificantSwingPoints(bars, opts) {
    const { left = 3, right = 3, atrPeriod = 14, promAtr = 1.5, departAtr = 2.5, departLookahead = 10, minSwingSep = 7, } = opts ?? {};
    if (bars.length < left + right + 2)
        return [];
    const atrValues = (0, atr_1.atrSeries)(bars, atrPeriod);
    const candidates = [];
    for (let t = left; t <= bars.length - right - 1; t++) {
        const a = atrValues[t];
        if (!Number.isFinite(a) || a <= 0)
            continue;
        let isPivotHigh = true;
        for (let i = t - left; i <= t + right; i++) {
            if (i === t)
                continue;
            if (bars[i].high >= bars[t].high) {
                isPivotHigh = false;
                break;
            }
        }
        if (isPivotHigh) {
            let localMinLow = Infinity;
            for (let i = t - left; i <= t + right; i++) {
                if (bars[i].low < localMinLow)
                    localMinLow = bars[i].low;
            }
            const prominence = bars[t].high - localMinLow;
            if (prominence >= promAtr * a) {
                const depEnd = Math.min(bars.length - 1, t + departLookahead);
                let minLowAfter = Infinity;
                for (let j = t + 1; j <= depEnd; j++) {
                    if (bars[j].low < minLowAfter)
                        minLowAfter = bars[j].low;
                }
                if (minLowAfter <= bars[t].high - departAtr * a) {
                    candidates.push({
                        index: t,
                        price: bars[t].high,
                        type: 'HIGH',
                        atr: a,
                        prominence,
                    });
                }
            }
        }
        let isPivotLow = true;
        for (let i = t - left; i <= t + right; i++) {
            if (i === t)
                continue;
            if (bars[i].low <= bars[t].low) {
                isPivotLow = false;
                break;
            }
        }
        if (isPivotLow) {
            let localMaxHigh = -Infinity;
            for (let i = t - left; i <= t + right; i++) {
                if (bars[i].high > localMaxHigh)
                    localMaxHigh = bars[i].high;
            }
            const prominence = localMaxHigh - bars[t].low;
            if (prominence >= promAtr * a) {
                const depEnd = Math.min(bars.length - 1, t + departLookahead);
                let maxHighAfter = -Infinity;
                for (let j = t + 1; j <= depEnd; j++) {
                    if (bars[j].high > maxHighAfter)
                        maxHighAfter = bars[j].high;
                }
                if (maxHighAfter >= bars[t].low + departAtr * a) {
                    candidates.push({
                        index: t,
                        price: bars[t].low,
                        type: 'LOW',
                        atr: a,
                        prominence,
                    });
                }
            }
        }
    }
    candidates.sort((a, b) => a.index - b.index);
    const result = [];
    for (const p of candidates) {
        const last = result[result.length - 1];
        if (!last) {
            result.push(p);
            continue;
        }
        if (p.type === last.type && p.index - last.index <= minSwingSep) {
            const keepNew = p.type === 'HIGH' ? p.price > last.price : p.price < last.price;
            if (keepNew) {
                result[result.length - 1] = p;
            }
        }
        else {
            result.push(p);
        }
    }
    return result;
}
//# sourceMappingURL=swing-points.js.map