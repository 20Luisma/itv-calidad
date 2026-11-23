import { exportReportAsMarkdown } from '../../application/ExportReportMarkdown.js';
import { RunItvInspection } from '../../application/RunItvInspection.js';
import type { InspectionReport } from '../../domain/types.js';
import { loadLocalEnv } from '../../infrastructure/config/loadDotEnv.js';
import { SafeCommandExecutor } from '../../infrastructure/exec/SafeCommandExecutor.js';
import { createDefaultStations } from '../../infrastructure/stations/index.js';

export interface RunItvInput {
  repoPath: string;
  minCoverage?: number | undefined;
  targetUrl?: string | undefined;
  format?: 'json' | 'markdown' | undefined;
}

export interface McpToolResponse {
  [key: string]: unknown;
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

export type InspectionRunner = {
  execute: (input: {
    repoPath: string;
    slowMotionMs?: number;
    minCoverage?: number;
    targetUrl?: string;
  }) => Promise<InspectionReport>;
};

function createDefaultRunner(): InspectionRunner {
  loadLocalEnv();
  return new RunItvInspection(createDefaultStations(), new SafeCommandExecutor());
}

export function handleListStations(): McpToolResponse {
  const stations = createDefaultStations().map((s) => ({
    id: s.metadata.id,
    order: s.metadata.order,
    name: s.metadata.name,
    whatItChecks: s.metadata.didactic.whatItChecks,
    whyItMatters: s.metadata.didactic.whyItMatters
  }));

  return {
    content: [{ type: 'text', text: JSON.stringify({ totalStations: stations.length, stations }, null, 2) }]
  };
}

export async function handleRunItv(
  input: RunItvInput,
  runner: InspectionRunner = createDefaultRunner()
): Promise<McpToolResponse> {
  try {
    const report = await runner.execute({
      repoPath: input.repoPath,
      slowMotionMs: 0,
      minCoverage: input.minCoverage ?? 75,
      ...(input.targetUrl ? { targetUrl: input.targetUrl } : {})
    });

    const text =
      input.format === 'markdown'
        ? exportReportAsMarkdown(report)
        : JSON.stringify(
            {
              verdict: report.verdict,
              blocksPush: report.blocksPush,
              repoName: report.stack.repoName,
              primaryStack: report.stack.primaryStack,
              gitBranch: report.stack.gitBranch,
              summary: report.summary,
              securityChecklist: report.securityChecklist,
              stations: report.stations.map((s) => ({
                order: s.order,
                name: s.name,
                status: s.status,
                summary: s.summary,
                findings: s.findings
              }))
            },
            null,
            2
          );

    return { content: [{ type: 'text', text }] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      isError: true,
      content: [{ type: 'text', text: `Error ejecutando ITV de Código: ${message}` }]
    };
  }
}

export async function handleSecurityChecklist(
  input: { repoPath: string },
  runner: InspectionRunner = createDefaultRunner()
): Promise<McpToolResponse> {
  try {
    const report = await runner.execute({
      repoPath: input.repoPath,
      slowMotionMs: 0,
      minCoverage: 75
    });

    const securityStation = report.stations.find((s) => s.order === 4);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              repoName: report.stack.repoName,
              verdict: report.verdict,
              securityStation: securityStation
                ? {
                    status: securityStation.status,
                    summary: securityStation.summary,
                    findings: securityStation.findings
                  }
                : null,
              checklist: report.securityChecklist ?? null
            },
            null,
            2
          )
        }
      ]
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      isError: true,
      content: [{ type: 'text', text: `Error generando checklist de seguridad: ${message}` }]
    };
  }
}
