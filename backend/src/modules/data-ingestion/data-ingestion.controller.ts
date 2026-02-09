import { Controller, Post, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { PipelineService } from './services/pipeline.service';

/**
 * Manual pipeline trigger and status endpoints.
 */
@Controller('api/pipeline')
@AllowAnonymous()
export class DataIngestionController {
  constructor(private readonly pipelineService: PipelineService) {}

  /**
   * POST /api/pipeline/run -- Trigger the full data pipeline.
   * Returns immediately with 202 Accepted if the pipeline starts.
   */
  @Post('run')
  @HttpCode(HttpStatus.ACCEPTED)
  async triggerPipeline(): Promise<{ message: string }> {
    if (this.pipelineService.isRunning()) {
      return { message: 'Pipeline is already running' };
    }

    // Start pipeline in background (don't await)
    this.pipelineService.runFullPipeline().catch(() => {
      // Error already logged inside PipelineService
    });

    return { message: 'Pipeline started' };
  }

  /**
   * GET /api/pipeline/status -- Return current sync status.
   */
  @Get('status')
  async getStatus() {
    return this.pipelineService.getStatus();
  }
}
