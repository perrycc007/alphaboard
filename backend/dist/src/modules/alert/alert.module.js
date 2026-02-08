"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertModule = void 0;
const common_1 = require("@nestjs/common");
const alert_controller_1 = require("./alert.controller");
const alert_service_1 = require("./alert.service");
const alert_gateway_1 = require("./alert.gateway");
let AlertModule = class AlertModule {
};
exports.AlertModule = AlertModule;
exports.AlertModule = AlertModule = __decorate([
    (0, common_1.Module)({
        controllers: [alert_controller_1.AlertController],
        providers: [alert_service_1.AlertService, alert_gateway_1.AlertGateway],
        exports: [alert_service_1.AlertService, alert_gateway_1.AlertGateway],
    })
], AlertModule);
//# sourceMappingURL=alert.module.js.map