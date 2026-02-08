"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var PaperBrokerAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaperBrokerAdapter = void 0;
const common_1 = require("@nestjs/common");
let PaperBrokerAdapter = PaperBrokerAdapter_1 = class PaperBrokerAdapter {
    name = 'PaperBroker';
    logger = new common_1.Logger(PaperBrokerAdapter_1.name);
    positions = new Map();
    orders = new Map();
    orderCounter = 0;
    async submitOrder(request) {
        const id = `PAPER-${++this.orderCounter}`;
        const fillPrice = request.limitPrice ?? request.stopPrice ?? 0;
        const order = {
            id,
            request,
            status: 'FILLED',
            filledQty: request.quantity,
            avgPrice: fillPrice,
        };
        this.orders.set(id, order);
        const existing = this.positions.get(request.ticker);
        if (existing) {
            const totalQty = existing.quantity + request.quantity;
            existing.avgEntry =
                (existing.avgEntry * existing.quantity +
                    fillPrice * request.quantity) /
                    totalQty;
            existing.quantity = totalQty;
        }
        else {
            this.positions.set(request.ticker, {
                ticker: request.ticker,
                quantity: request.quantity,
                avgEntry: fillPrice,
                side: request.side,
            });
        }
        this.logger.log(`Paper order ${id}: ${request.side} ${request.quantity} ${request.ticker} @ ${fillPrice}`);
        return { brokerOrderId: id, status: 'SUBMITTED' };
    }
    async cancelOrder(brokerOrderId) {
        const order = this.orders.get(brokerOrderId);
        if (!order || order.status !== 'SUBMITTED')
            return false;
        order.status = 'CANCELLED';
        return true;
    }
    async getPositions() {
        return Array.from(this.positions.values()).map((p) => ({
            ticker: p.ticker,
            quantity: p.quantity,
            avgEntry: p.avgEntry,
            unrealizedPnl: 0,
        }));
    }
    async getOrderStatus(brokerOrderId) {
        const order = this.orders.get(brokerOrderId);
        if (!order) {
            return { status: 'UNKNOWN', filledQty: 0, avgPrice: 0 };
        }
        return {
            status: order.status,
            filledQty: order.filledQty,
            avgPrice: order.avgPrice,
        };
    }
};
exports.PaperBrokerAdapter = PaperBrokerAdapter;
exports.PaperBrokerAdapter = PaperBrokerAdapter = PaperBrokerAdapter_1 = __decorate([
    (0, common_1.Injectable)()
], PaperBrokerAdapter);
//# sourceMappingURL=paper-broker.adapter.js.map