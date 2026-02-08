"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.priceEfficiency = priceEfficiency;
function priceEfficiency(bars) {
    if (bars.length < 2)
        return 0;
    const netMove = Math.abs(bars[bars.length - 1].close - bars[0].close);
    let totalPath = 0;
    for (let i = 1; i < bars.length; i++) {
        totalPath += Math.abs(bars[i].close - bars[i - 1].close);
    }
    if (totalPath === 0)
        return 0;
    return netMove / totalPath;
}
//# sourceMappingURL=price-efficiency.js.map