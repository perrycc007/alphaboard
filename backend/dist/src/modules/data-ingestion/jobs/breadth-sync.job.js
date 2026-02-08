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
var BreadthSyncJob_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BreadthSyncJob = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const prisma_service_1 = require("../../../prisma/prisma.service");
let BreadthSyncJob = BreadthSyncJob_1 = class BreadthSyncJob {
    prisma;
    logger = new common_1.Logger(BreadthSyncJob_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async run() {
        this.logger.log('Starting breadth sync...');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        await this.prisma.breadthSnapshot.upsert({
            where: { date: today },
            create: { date: today },
            update: {},
        });
        this.logger.log('Breadth sync complete');
    }
};
exports.BreadthSyncJob = BreadthSyncJob;
__decorate([
    (0, schedule_1.Cron)('15 17 * * 1-5'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], BreadthSyncJob.prototype, "run", null);
exports.BreadthSyncJob = BreadthSyncJob = BreadthSyncJob_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BreadthSyncJob);
//# sourceMappingURL=breadth-sync.job.js.map