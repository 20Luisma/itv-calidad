import { createStationResult } from '../../domain/report.js';
import type {
  CommandResult,
  StationContext,
  StationMetadata,
  StationResult
} from '../../domain/types.js';

export async function runStationCommand(
  context: StationContext,
  binary: string,
  args: readonly string[]
): Promise<{ res: CommandResult; combinedOutput: string }> {
  const res = await context.executor.run(binary, args, {
    cwd: context.repoPath,
    timeoutMs: context.commandTimeoutMs,
    ...(context.signal ? { signal: context.signal } : {})
  });
  return {
    res,
    combinedOutput: [res.stdout, res.stderr].filter(Boolean).join('\n')
  };
}

export function createMissingBinaryResult(params: {
  metadata: StationMetadata;
  command: string;
  durationMs: number;
  summary: string;
  rawOutput: string;
  findingTitle: string;
  findingReason: string;
  howToFix: string;
}): StationResult {
  return createStationResult({
    metadata: params.metadata,
    command: params.command,
    status: 'warn',
    durationMs: params.durationMs,
    summary: params.summary,
    rawOutput: params.rawOutput,
    findings: [
      {
        severity: 'warning',
        title: params.findingTitle,
        reason: params.findingReason,
        howToFix: params.howToFix
      }
    ]
  });
}
