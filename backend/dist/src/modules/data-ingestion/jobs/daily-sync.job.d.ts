import { PipelineService } from '../services/pipeline.service';
export declare class DailySyncJob {
    private readonly pipelineService;
    private readonly logger;
    constructor(pipelineService: PipelineService);
    run(): Promise<void>;
}
