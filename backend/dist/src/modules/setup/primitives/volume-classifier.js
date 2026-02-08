"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.classifyVolume = classifyVolume;
function classifyVolume(currentVolume, avgVolume, expansionK = 1.5, contractionM = 0.6) {
    if (avgVolume === 0)
        return 'NORMAL';
    const ratio = currentVolume / avgVolume;
    if (ratio > expansionK)
        return 'EXPANSION';
    if (ratio < contractionM)
        return 'CONTRACTION';
    return 'NORMAL';
}
//# sourceMappingURL=volume-classifier.js.map