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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var AlertGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const common_1 = require("@nestjs/common");
let AlertGateway = AlertGateway_1 = class AlertGateway {
    server;
    logger = new common_1.Logger(AlertGateway_1.name);
    handleSubscribeAlerts(data, client) {
        client.join(`alerts:${data.userId}`);
        this.logger.log(`Client ${client.id} subscribed to alerts for ${data.userId}`);
    }
    handleSubscribeIntraday(data, client) {
        client.join(`intraday:${data.ticker}`);
        this.logger.log(`Client ${client.id} subscribed to intraday ${data.ticker}`);
    }
    sendAlert(userId, payload) {
        this.server.to(`alerts:${userId}`).emit('alert', payload);
    }
    sendIntradayBar(ticker, bar) {
        this.server.to(`intraday:${ticker}`).emit('bar', { ticker, ...bar });
    }
};
exports.AlertGateway = AlertGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], AlertGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('subscribe:alerts'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], AlertGateway.prototype, "handleSubscribeAlerts", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('subscribe:intraday'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], AlertGateway.prototype, "handleSubscribeIntraday", null);
exports.AlertGateway = AlertGateway = AlertGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({ namespace: '/ws', cors: { origin: '*' } })
], AlertGateway);
//# sourceMappingURL=alert.gateway.js.map