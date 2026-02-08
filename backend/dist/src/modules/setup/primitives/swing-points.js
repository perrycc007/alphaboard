"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectSwingPoints = detectSwingPoints;
const average_bar_size_1 = require("./average-bar-size");
function detectSwingPoints(bars, lookahead = 10) {
    if (bars.length < lookahead + 1)
        return [];
    const abs = (0, average_bar_size_1.averageBarSize)(bars);
    const points = [];
    for (let t = 0; t <= bars.length - lookahead - 1; t++) {
        const h0 = bars[t].high;
        const l0 = bars[t].low;
        let isSwingHigh = true;
        for (let i = t + 1; i <= t + lookahead; i++) {
            if (bars[i].high >= h0 - abs) {
                isSwingHigh = false;
                break;
            }
        }
        if (isSwingHigh) {
            points.push({ index: t, price: h0, type: 'HIGH', absValue: abs });
        }
        let isSwingLow = true;
        for (let i = t + 1; i <= t + lookahead; i++) {
            if (bars[i].low <= l0 + abs) {
                isSwingLow = false;
                break;
            }
        }
        if (isSwingLow) {
            points.push({ index: t, price: l0, type: 'LOW', absValue: abs });
        }
    }
    return points;
}
//# sourceMappingURL=swing-points.js.map