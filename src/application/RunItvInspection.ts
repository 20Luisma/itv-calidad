import { randomUUID } from 'node:crypto';
import { buildInspectionReport } from '../domain/report.js';
import type {
  CommandExecutor,
  InspectionEventListener,
  InspectionOptions,
  InspectionReport,
  StationContext,
  StationResult,
  StationRunner
} from '../domain/types.js';
import { detectRepoStack } from './DetectRepoStack.js';

const DEFAULT_SLOW_MOTION_MS = 900;
const DEFAULT_MIN_COVERAGE = 75;
const DEFAULT_COMMAND_TIMEOUT_MS = 120_000;

async function delayWithAbort(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return;
  if (signal?.aborted) {
    throw new Error('Inspección cancelada por el usuario.');
  }

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timer);
      cleanup();
      reject(new Error('Inspección cancelada por el usuario.'));
    };

    const cleanup = () => {
      signal?.removeEventListener('abort', onAbort);
    };

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export class RunItvInspection {
  constructor(
    private readonly stations: readonly StationRunner[],
    private readonly executor: CommandExecutor
  ) {}

  async execute(
    options: InspectionOptions,
    onEvent?: InspectionEventListener
  ): Promise<InspectionReport> {
    const inspectionId = randomUUID();
    const slowMotionMs = options.slowMotionMs ?? DEFAULT_SLOW_MOTION_MS;
    const minCoverage = options.minCoverage ?? DEFAULT_MIN_COVERAGE;
    const commandTimeoutMs = options.commandTimeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS;
    const startedAt = new Date();

    try {
      const stack = await detectRepoStack(options.repoPath);

      onEvent?.({
        type: 'inspection:start',
        inspectionId,
        stack,
        totalStations: this.stations.length,
        slowMotionMs
      });

      const results: StationResult[] = [];
      const context: StationContext = options.signal
        ? {
            repoPath: stack.repoPath,
            stack,
            minCoverage,
            commandTimeoutMs,
            executor: this.executor,
            signal: options.signal
          }
        : {
            repoPath: stack.repoPath,
            stack,
            minCoverage,
            commandTimeoutMs,
            executor: this.executor
          };

      for (const station of this.stations) {
        if (options.signal?.aborted) {
          throw new Error('Inspección cancelada por el usuario.');
        }

        onEvent?.({
          type: 'station:start',
          inspectionId,
          station: station.metadata
        });

        // Pausa didáctica breve al entrar en la estación para efecto "cámara lenta"
        if (slowMotionMs > 0) {
          await delayWithAbort(Math.round(slowMotionMs * 0.45), options.signal);
        }

        const result = await station.run(context);
        results.push(result);

        onEvent?.({
          type: 'station:complete',
          inspectionId,
          result
        });

        if (slowMotionMs > 0) {
          await delayWithAbort(Math.round(slowMotionMs * 0.55), options.signal);
        }
      }

      const report = buildInspectionReport({
        inspectionId,
        startedAt,
        finishedAt: new Date(),
        stack,
        stations: results
      });

      onEvent?.({
        type: 'inspection:complete',
        inspectionId,
        report
      });

      return report;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error inesperado en la ITV.';
      onEvent?.({
        type: 'inspection:error',
        inspectionId,
        message
      });
      throw error;
    }
  }
}
