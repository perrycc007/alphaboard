import { Injectable, Logger } from '@nestjs/common';
import { Direction, SetupType, Timeframe } from '@prisma/client';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { Bar } from '../../common/types';
import { DetectedSetup } from './detectors/detector.interface';

interface PythonSignal {
  setup_type: string;
  index: number;
  date: string;
  price: number;
  stop: number;
  target: number;
  rr: number;
  signal_type: string;
  metadata?: Record<string, unknown>;
}

interface PythonDetectionResponse {
  signals?: PythonSignal[];
  base_count?: number;
  rule_version?: string;
}

const PYTHON_SETUP_MAP: Record<string, SetupType> = {
  TREND_LONG_20EMA_PULLBACK: SetupType.EMA20_PULLBACK,
  TREND_LONG_20EMA_LEGACY: SetupType.EMA20_PULLBACK,
  BASE_MA_LONG: SetupType.PULLBACK_BUY,
  BASE_FAILURE_SHORT: SetupType.FAIL_BASE,
  TREND_SHORT_20EMA_RALLY: SetupType.MA_RALLY_FAILURE,
  BASE_REGION: SetupType.VCP,
  DOUBLE_TOP: SetupType.DOUBLE_TOP,
  DOUBLE_BOTTOM: SetupType.UNDERCUT_RALLY,
};

@Injectable()
export class PythonSignalDetectorService {
  private readonly logger = new Logger(PythonSignalDetectorService.name);
  private readonly workspaceRoot = resolve(__dirname, '../../../..');
  private readonly pythonProjectDir = join(
    this.workspaceRoot,
    'python setup detector',
  );
  private readonly bridgeScript = join(
    this.pythonProjectDir,
    'detect_signals_json.py',
  );
  private readonly ruleConfigPath = join(
    this.pythonProjectDir,
    'rule_configs',
    'python_v1.json',
  );

  async detectDailySignals(bars: Bar[]): Promise<DetectedSetup[]> {
    if (bars.length < 80) return [];
    if (!existsSync(this.bridgeScript)) {
      this.logger.warn(`Python signal bridge missing: ${this.bridgeScript}`);
      return [];
    }

    const payload = {
      bars: bars.map((bar) => ({
        date: bar.date?.toISOString() ?? bar.timestamp?.toISOString(),
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
      })),
      config_path: this.ruleConfigPath,
    };

    const response = await this.runPython(payload);
    const latestIndex = bars.length - 1;
    const signals = (response.signals ?? []).filter(
      (signal) => signal.index === latestIndex,
    );
    return signals
      .map((signal) => this.toDetectedSetup(signal, response))
      .filter((setup): setup is DetectedSetup => setup != null);
  }

  private toDetectedSetup(
    signal: PythonSignal,
    response: PythonDetectionResponse,
  ): DetectedSetup | null {
    const setupType = PYTHON_SETUP_MAP[signal.setup_type];
    if (!setupType) {
      this.logger.warn(`Unmapped Python setup type: ${signal.setup_type}`);
      return null;
    }

    const metadata = signal.metadata ?? {};
    const direction = this.inferDirection(signal, setupType);
    const pivotPrice = this.finiteNumber(signal.price);
    const stopPrice = this.finiteNumber(signal.stop);
    const targetPrice = this.finiteNumber(signal.target);
    const riskReward = this.finiteNumber(signal.rr);

    return {
      type: setupType,
      direction,
      timeframe: Timeframe.DAILY,
      pivotPrice,
      stopPrice,
      targetPrice,
      riskReward,
      evidence: [
        `python:${signal.setup_type}`,
        `signal:${signal.signal_type}`,
      ],
      waitingFor: 'Confirm Python detector alert at the key level',
      metadata: {
        ...metadata,
        source: 'python_setup_detector',
        pythonSetupType: signal.setup_type,
        pythonSignalType: signal.signal_type,
        pythonRuleVersion: response.rule_version,
        pythonBaseCount: response.base_count,
        keyLevel: pivotPrice,
        originalDirection: metadata.direction,
      },
    };
  }

  private inferDirection(signal: PythonSignal, setupType: SetupType): Direction {
    const raw =
      typeof signal.metadata?.direction === 'string'
        ? signal.metadata.direction.toUpperCase()
        : '';
    if (raw === Direction.LONG || raw === Direction.SHORT) return raw;
    if (
      setupType === SetupType.DOUBLE_TOP ||
      setupType === SetupType.FAIL_BASE ||
      setupType === SetupType.MA_RALLY_FAILURE
    ) {
      return Direction.SHORT;
    }
    return Direction.LONG;
  }

  private finiteNumber(value: unknown): number | undefined {
    const num = Number(value);
    return Number.isFinite(num) ? num : undefined;
  }

  private runPython(payload: unknown): Promise<PythonDetectionResponse> {
    const python = this.resolvePythonExecutable();
    const input = JSON.stringify(payload);

    return new Promise((resolvePromise, reject) => {
      const child = spawn(python, [this.bridgeScript], {
        cwd: this.pythonProjectDir,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error('Python signal detector timed out'));
      }, 30_000);

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
      child.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          reject(
            new Error(
              `Python signal detector exited ${code}: ${stderr.trim()}`,
            ),
          );
          return;
        }
        try {
          resolvePromise(JSON.parse(stdout) as PythonDetectionResponse);
        } catch (error) {
          reject(
            new Error(
              `Python signal detector returned invalid JSON: ${
                error instanceof Error ? error.message : String(error)
              }`,
            ),
          );
        }
      });

      child.stdin.end(input);
    });
  }

  private resolvePythonExecutable(): string {
    if (process.env.PYTHON_SETUP_DETECTOR_BIN) {
      return process.env.PYTHON_SETUP_DETECTOR_BIN;
    }
    const anacondaPython = 'C:\\Users\\perry\\anaconda3\\python.exe';
    if (existsSync(anacondaPython)) return anacondaPython;
    return process.env.PYTHON_BIN ?? 'python';
  }
}
