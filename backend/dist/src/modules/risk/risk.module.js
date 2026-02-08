"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiskModule = void 0;
const common_1 = require("@nestjs/common");
const risk_controller_1 = require("./risk.controller");
const risk_engine_service_1 = require("./risk-engine.service");
let RiskModule = class RiskModule {
};
exports.RiskModule = RiskModule;
exports.RiskModule = RiskModule = __decorate([
    (0, common_1.Module)({
        controllers: [risk_controller_1.RiskController],
        providers: [risk_engine_service_1.RiskEngineService],
        exports: [risk_engine_service_1.RiskEngineService],
    })
], RiskModule);
//# sourceMappingURL=risk.module.js.map