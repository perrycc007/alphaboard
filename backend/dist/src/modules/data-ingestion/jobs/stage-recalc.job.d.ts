import { PrismaService } from '../../../prisma/prisma.service';
import { StageClassifierService } from '../../stock/services/stage-classifier.service';
export declare class StageRecalcJob {
    private readonly prisma;
    private readonly stageClassifier;
    private readonly logger;
    constructor(prisma: PrismaService, stageClassifier: StageClassifierService);
    run(): Promise<void>;
}
