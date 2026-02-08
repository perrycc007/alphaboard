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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradeController = void 0;
const common_1 = require("@nestjs/common");
const trade_lifecycle_service_1 = require("./trade-lifecycle.service");
let TradeController = class TradeController {
    tradeService;
    constructor(tradeService) {
        this.tradeService = tradeService;
    }
    createIdea(body) {
        return this.tradeService.createIdea(body);
    }
    listIdeas() {
        return this.tradeService.listIdeas();
    }
    confirmIdea(id) {
        return this.tradeService.confirmIdea(id);
    }
    skipIdea(id) {
        return this.tradeService.skipIdea(id);
    }
    placeOrder(intentId, body) {
        return this.tradeService.placeOrder(intentId, body);
    }
    listPositions() {
        return this.tradeService.listPositions();
    }
    updateStop(id, body) {
        return this.tradeService.updateStop(id, body.stopPrice);
    }
    closePosition(id) {
        return this.tradeService.closePosition(id);
    }
};
exports.TradeController = TradeController;
__decorate([
    (0, common_1.Post)('ideas'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], TradeController.prototype, "createIdea", null);
__decorate([
    (0, common_1.Get)('ideas'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], TradeController.prototype, "listIdeas", null);
__decorate([
    (0, common_1.Post)('ideas/:id/confirm'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], TradeController.prototype, "confirmIdea", null);
__decorate([
    (0, common_1.Post)('ideas/:id/skip'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], TradeController.prototype, "skipIdea", null);
__decorate([
    (0, common_1.Post)('intents/:id/order'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], TradeController.prototype, "placeOrder", null);
__decorate([
    (0, common_1.Get)('positions'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], TradeController.prototype, "listPositions", null);
__decorate([
    (0, common_1.Put)('positions/:id/stop'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], TradeController.prototype, "updateStop", null);
__decorate([
    (0, common_1.Post)('positions/:id/close'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], TradeController.prototype, "closePosition", null);
exports.TradeController = TradeController = __decorate([
    (0, common_1.Controller)('api/trades'),
    __metadata("design:paramtypes", [trade_lifecycle_service_1.TradeLifecycleService])
], TradeController);
//# sourceMappingURL=trade.controller.js.map