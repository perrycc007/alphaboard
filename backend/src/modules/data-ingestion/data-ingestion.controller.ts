import {
  BadRequestException,
  Controller,
  Post,
  Get,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { PipelineService } from './services/pipeline.service';
import { SetupScanJob } from './jobs/setup-scan.job';
import { PIPELINE_STEP_IDS, selectPipelineSteps } from './services/pipeline-steps';

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
  async triggerPipeline(
    @Query('fromStep') fromStep?: string,
    @Query('toStep') toStep?: string,
    @Query('skipBackfill') skipBackfill?: string,
  ): Promise<{ message: string }> {
    if (this.pipelineService.isRunning()) {
      return { message: 'Pipeline is already running' };
    }

    try {
      selectPipelineSteps(fromStep, toStep, PIPELINE_STEP_IDS);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : String(error),
      );
    }

    const skip =
      skipBackfill === 'true' ||
      process.env.PIPELINE_SKIP_BACKFILL?.toLowerCase() === 'true';

    // Start pipeline in background (don't await)
    this.pipelineService.runFullPipeline({
      fromStep,
      toStep,
      ...(skip ? { skipBackfill: true } : {}),
    }).catch(() => {
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

@Controller('api/setups')
@AllowAnonymous()
export class SetupScanController {
  constructor(private readonly setupScanJob: SetupScanJob) {}

  @Post('scan')
  @HttpCode(HttpStatus.ACCEPTED)
  triggerScan(): { message: string } {
    if (this.setupScanJob.isRunning()) {
      return { message: 'Setup scan is already running' };
    }

    this.setupScanJob.run().catch(() => undefined);
    return { message: 'Setup scan started' };
  }
}
