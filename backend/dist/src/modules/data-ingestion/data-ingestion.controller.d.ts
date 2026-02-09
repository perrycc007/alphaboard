import { PipelineService } from './services/pipeline.service';
export declare class DataIngestionController {
    private readonly pipelineService;
    constructor(pipelineService: PipelineService);
    triggerPipeline(): Promise<{
        message: string;
    }>;
    getStatus(): Promise<import("./services/pipeline.service").PipelineStatus>;
}
