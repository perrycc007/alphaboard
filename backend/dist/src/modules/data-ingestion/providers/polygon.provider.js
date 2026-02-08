"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var PolygonProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PolygonProvider = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let PolygonProvider = PolygonProvider_1 = class PolygonProvider {
    configService;
    logger = new common_1.Logger(PolygonProvider_1.name);
    apiKey;
    restUrl;
    constructor(configService) {
        this.configService = configService;
        this.apiKey = this.configService.get('polygon.apiKey', '');
        this.restUrl = this.configService.get('polygon.restUrl', 'https://api.polygon.io');
    }
    async fetchIntradayBars(ticker, date) {
        this.logger.log(`Fetching intraday bars for ${ticker} on ${date.toISOString().slice(0, 10)}`);
        if (!this.apiKey) {
            this.logger.warn('Polygon API key not configured');
            return [];
        }
        return [];
    }
};
exports.PolygonProvider = PolygonProvider;
exports.PolygonProvider = PolygonProvider = PolygonProvider_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], PolygonProvider);
//# sourceMappingURL=polygon.provider.js.map