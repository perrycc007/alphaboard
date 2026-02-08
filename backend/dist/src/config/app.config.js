"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.databaseConfig = exports.polygonConfig = exports.appConfig = void 0;
const config_1 = require("@nestjs/config");
exports.appConfig = (0, config_1.registerAs)('app', () => ({
    port: parseInt(process.env.PORT ?? '3000', 10),
    environment: process.env.NODE_ENV ?? 'development',
}));
exports.polygonConfig = (0, config_1.registerAs)('polygon', () => ({
    apiKey: process.env.POLYGON_API_KEY ?? '',
    wsUrl: process.env.POLYGON_WS_URL ?? 'wss://socket.polygon.io',
    restUrl: process.env.POLYGON_REST_URL ?? 'https://api.polygon.io',
}));
exports.databaseConfig = (0, config_1.registerAs)('database', () => ({
    url: process.env.DATABASE_URL ?? '',
}));
//# sourceMappingURL=app.config.js.map