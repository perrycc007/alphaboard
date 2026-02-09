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
var DailySyncJob_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DailySyncJob = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const pipeline_service_1 = require("../services/pipeline.service");
let DailySyncJob = DailySyncJob_1 = class DailySyncJob {
    pipelineService;
    logger = new common_1.Logger(DailySyncJob_1.name);
    constructor(pipelineService) {
        this.pipelineService = pipelineService;
    }
    async run() {
        if (this.pipelineService.isRunning()) {
            this.logger.log('Pipeline already running, skipping daily sync cron');
            return;
        }
        this.logger.log('Daily sync cron triggered, delegating to pipeline...');
        try {
            await this.pipelineService.checkAndSync();
        }
        catch (err) {
            this.logger.error('Daily sync pipeline failed', err);
        }
    }
};
exports.DailySyncJob = DailySyncJob;
__decorate([
    (0, schedule_1.Cron)('0 17 * * 1-5'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], DailySyncJob.prototype, "run", null);
exports.DailySyncJob = DailySyncJob = DailySyncJob_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)((0, common_1.forwardRef)(() => pipeline_service_1.PipelineService))),
    __metadata("design:paramtypes", [pipeline_service_1.PipelineService])
], DailySyncJob);
//# sourceMappingURL=daily-sync.job.js.map