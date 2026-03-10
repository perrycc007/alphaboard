"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.appendJsonLog = appendJsonLog;
exports.readJsonLog = readJsonLog;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const LOG_ROOT = path.resolve(process.cwd(), '../artifacts/setup_review/logs');
async function readJsonArray(filePath) {
    if (!fs.existsSync(filePath))
        return [];
    const raw = await fs.promises.readFile(filePath, 'utf-8');
    if (!raw.trim())
        return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
}
async function appendJsonLog(fileName, entry) {
    const filePath = path.join(LOG_ROOT, fileName);
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    const rows = await readJsonArray(filePath);
    rows.push({
        ...entry,
        loggedAt: new Date().toISOString(),
    });
    await fs.promises.writeFile(filePath, JSON.stringify(rows, null, 2));
}
async function readJsonLog(fileName) {
    const filePath = path.join(LOG_ROOT, fileName);
    return readJsonArray(filePath);
}
//# sourceMappingURL=file-log.util.js.map