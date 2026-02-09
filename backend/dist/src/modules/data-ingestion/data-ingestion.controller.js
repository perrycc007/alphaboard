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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataIngestionController = void 0;
const common_1 = require("@nestjs/common");
const nestjs_better_auth_1 = require("@thallesp/nestjs-better-auth");
const pipeline_service_1 = require("./services/pipeline.service");
let DataIngestionController = class DataIngestionController {
    pipelineService;
    constructor(pipelineService) {
        this.pipelineService = pipelineService;
    }
    async triggerPipeline() {
        if (this.pipelineService.isRunning()) {
            return { message: 'Pipeline is already running' };
        }
        this.pipelineService.runFullPipeline().catch(() => {
        });
        return { message: 'Pipeline started' };
    }
    async getStatus() {
        return this.pipelineService.getStatus();
    }
};
exports.DataIngestionController = DataIngestionController;
__decorate([
    (0, common_1.Post)('run'),
    (0, common_1.HttpCode)(common_1.HttpStatus.ACCEPTED),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], DataIngestionController.prototype, "triggerPipeline", null);
__decorate([
    (0, common_1.Get)('status'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], DataIngestionController.prototype, "getStatus", null);
exports.DataIngestionController = DataIngestionController = __decorate([
    (0, common_1.Controller)('api/pipeline'),
    (0, nestjs_better_auth_1.AllowAnonymous)(),
    __metadata("design:paramtypes", [pipeline_service_1.PipelineService])
], DataIngestionController);
//# sourceMappingURL=data-ingestion.controller.js.map