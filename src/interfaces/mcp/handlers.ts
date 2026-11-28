import { exportReportAsMarkdown } from '../../application/ExportReportMarkdown.js';
import { RunItvInspection } from '../../application/RunItvInspection.js';
import { getCoreLabels, resolveLang, type SupportedLang } from '../../domain/i18n.js';
import type { InspectionReport } from '../../domain/types.js';
import { loadLocalEnv } from '../../infrastructure/config/loadDotEnv.js';
import { SafeCommandExecutor } from '../../infrastructure/exec/SafeCommandExecutor.js';
import { createDefaultStations } from '../../infrastructure/stations/index.js';

export interface RunItvInput {
  repoPath?: string | undefined;
  minCoverage?: number | undefined;
  targetUrl?: string | undefined;
  format?: 'json' | 'markdown' | undefined;
  lang?: SupportedLang | undefined;
}

export interface McpToolResponse {
  [key: string]: unknown;
  content: Array<{ type: 'text'; text: string }>;
  structuredContent?: Record<string, unknown>;
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
    shortName: s.metadata.shortName,
    whatItChecks: s.metadata.didactic.whatItChecks,
    whyItMatters: s.metadata.didactic.whyItMatters
  }));

  return {
    content: [{ type: 'text', text: JSON.stringify({ totalStations: stations.length, stations }, null, 2) }],
    structuredContent: { totalStations: stations.length, stations }
  };
}

export async function handleRunItv(
  input: RunItvInput,
  runner: InspectionRunner = createDefaultRunner()
): Promise<McpToolResponse> {
  const lang = resolveLang(input.lang);
  const trimmedPath = input.repoPath?.trim();
  if (!trimmedPath) {
    const defaultRepoPath = process.cwd();
    return {
      content: [
        {
          type: 'text',
          text: getCoreLabels(lang).idleCockpitMsg(defaultRepoPath)
        }
      ],
      structuredContent: {
        mode: 'idle',
        defaultRepoPath
      }
    };
  }

  try {
    const report = await runner.execute({
      repoPath: trimmedPath,
      slowMotionMs: 0,
      minCoverage: input.minCoverage ?? 75,
      ...(input.targetUrl ? { targetUrl: input.targetUrl } : {})
    });

    const structuredPayload = {
      mode: 'report',
      verdict: report.verdict,
      blocksPush: report.blocksPush,
      repoName: report.stack.repoName,
      repoPath: report.stack.repoPath,
      primaryStack: report.stack.primaryStack,
      gitBranch: report.stack.gitBranch,
      totalDurationMs: report.totalDurationMs,
      summary: report.summary,
      ...(report.scope ? { scope: report.scope } : {}),
      securityChecklist: report.securityChecklist,
      stations: report.stations.map((s) => ({
        id: s.id,
        order: s.order,
        name: s.name,
        shortName: s.shortName,
        status: s.status,
        durationMs: s.durationMs,
        summary: s.summary,
        findings: s.findings,
        ...(s.externalLinks ? { externalLinks: s.externalLinks } : {})
      }))
    };

    const text =
      input.format === 'markdown'
        ? exportReportAsMarkdown(report, lang)
        : JSON.stringify(structuredPayload, null, 2);

    return {
      content: [{ type: 'text', text }],
      structuredContent: structuredPayload
    };
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
    const payload = {
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
    };

    return {
      content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      isError: true,
      content: [{ type: 'text', text: `Error generando checklist de seguridad: ${message}` }]
    };
  }
}
