#!/usr/bin/env node
import { exportReportAsMarkdown } from '../../application/ExportReportMarkdown.js';
import { initPrePushHook } from '../../application/InitPrePushHook.js';
import { RunItvInspection } from '../../application/RunItvInspection.js';
import { getCoreLabels, getLocalizedStationName, type SupportedLang } from '../../domain/i18n.js';
import type { InspectionEvent, StationStatus } from '../../domain/types.js';
import { loadLocalEnv } from '../../infrastructure/config/loadDotEnv.js';
import { SafeCommandExecutor } from '../../infrastructure/exec/SafeCommandExecutor.js';
import { createDefaultStations } from '../../infrastructure/stations/index.js';
import { parseCliArgs } from './parseArgs.js';

loadLocalEnv();

const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function formatStatus(status: StationStatus, lang: SupportedLang): string {
  const badge = getCoreLabels(lang).statusBadges[status];
  switch (status) {
    case 'pass':
      return `${ANSI.green}● ${badge}${ANSI.reset}`;
    case 'warn':
      return `${ANSI.yellow}▲ ${badge}${ANSI.reset}`;
    case 'fail':
      return `${ANSI.red}✖ ${badge}${ANSI.reset}`;
    case 'skipped':
      return `${ANSI.dim}○ ${badge}${ANSI.reset}`;
  }
}

function printHelp(): void {
  console.log(`
${ANSI.bold}ITV de Código — CLI local${ANSI.reset}

Uso:
  npm run itv -- [ruta-al-repo] [opciones]

Opciones:
  --fast               Sin pausas de cámara lenta (delay = 0ms)
  --delay <ms>         Pausa entre estaciones en cámara lenta (default: 800)
  --min-coverage <n>   Umbral mínimo de cobertura % (default: 75)
  --url <http://...>   URL local opcional para auditoría WCAG 2.1 AA en vivo (pa11y)
  --json               Imprime el reporte completo en JSON (útil para evidencias/CI)
  --markdown, --md     Imprime el informe de evidencia en Markdown
  --mcp                Inicia el servidor MCP Stdio (+ MCP App embebida)
  --init-hook          Instala el hook portable .githooks/pre-push en el repositorio
  --force              Sobrescribe .githooks/pre-push si ya existe (junto con --init-hook)
  --lang <es|en>       Idioma de salida para CLI y Markdown (default: es)
  --help, -h           Muestra esta ayuda
`);
}

async function main(): Promise<void> {
  const options = parseCliArgs(process.argv.slice(2), process.cwd());
  if (options.startMcp) {
    await import('../mcp/server.js');
    return;
  }
  if (options.showHelp) {
    printHelp();
    return;
  }

  const executor = new SafeCommandExecutor();
  if (options.initHook) {
    const result = await initPrePushHook(options.repoPath, executor, options.force);
    console.log(result.created ? `${ANSI.green}✔ ${result.message}${ANSI.reset}` : `${ANSI.yellow}▲ ${result.message}${ANSI.reset}`);
    if (!result.created) {
      process.exitCode = 1;
    }
    return;
  }
  const runner = new RunItvInspection(createDefaultStations(), executor);
  const t = getCoreLabels(options.lang);

  const onEvent = (event: InspectionEvent) => {
    if (options.format !== 'pretty') return;

    if (event.type === 'inspection:start') {
      console.log('');
      console.log(`${ANSI.bold}${ANSI.cyan}${t.cliBanner}${ANSI.reset}`);
      console.log(`${t.repository} : ${event.stack.repoName} (${event.stack.repoPath})`);
      console.log(
        `Stack       : ${event.stack.detectedStacks.join(', ')} (${t.primary}: ${event.stack.primaryStack})${event.stack.gitBranch ? ` · ${t.branchWord} ${event.stack.gitBranch}` : ''}`
      );
      console.log(`${t.slowMotion}: ${event.slowMotionMs} ${t.perStation}`);
      console.log('');
    } else if (event.type === 'station:start') {
      const stationTitle = getLocalizedStationName(event.station.id, event.station.name, options.lang);
      console.log(`${ANSI.bold}▶ ${stationTitle}${ANSI.reset}`);
      console.log(`  ${ANSI.dim}${event.station.didactic.whatItChecks}${ANSI.reset}`);
    } else if (event.type === 'station:complete') {
      const r = event.result;
      console.log(`  ${t.statusLabel}  : ${formatStatus(r.status, options.lang)} ${ANSI.dim}(${r.durationMs} ms)${ANSI.reset}`);
      console.log(`  ${t.command} : ${ANSI.dim}${r.command}${ANSI.reset}`);
      console.log(`  ${t.summary} : ${r.summary}`);

      for (const finding of r.findings.slice(0, 6)) {
        const loc = finding.file
          ? ` [${finding.file}${finding.line ? `:${finding.line}` : ''}]`
          : '';
        const color =
          finding.severity === 'error'
            ? ANSI.red
            : finding.severity === 'warning'
              ? ANSI.yellow
              : ANSI.cyan;
        console.log(`    ${color}• ${finding.title}${loc}${ANSI.reset}`);
        console.log(`      ${ANSI.dim}${t.reasonLabel}: ${finding.reason}${ANSI.reset}`);
        console.log(`      ${ANSI.dim}${t.fixLabel}: ${finding.howToFix}${ANSI.reset}`);
      }
      console.log('');
    }
  };

  try {
    const report = await runner.execute(
      {
        repoPath: options.repoPath,
        slowMotionMs: options.slowMotionMs,
        minCoverage: options.minCoverage,
        ...(options.targetUrl ? { targetUrl: options.targetUrl } : {})
      },
      onEvent
    );

    if (options.format === 'json') {
      console.log(JSON.stringify(report, null, 2));
    } else if (options.format === 'markdown') {
      console.log(exportReportAsMarkdown(report, options.lang));
    } else {
      const verdictColor =
        report.verdict === 'DESFAVORABLE'
          ? ANSI.red
          : report.verdict === 'APTO_CON_OBSERVACIONES'
            ? ANSI.yellow
            : ANSI.green;

      console.log(`${ANSI.bold}${t.finalVerdict}${ANSI.reset}`);
      console.log(`${t.resultLabel} : ${verdictColor}${ANSI.bold}${t.verdicts[report.verdict]}${ANSI.reset}`);
      console.log(
        `${t.stationsLabel}: ${t.summaryCounts(report.summary.passed, report.summary.warned, report.summary.failed, report.summary.skipped)}`
      );
      if (report.securityChecklist) {
        console.log(
          `${t.checklistLabel} : ${report.securityChecklist.automatedPassed}/${report.securityChecklist.automatedTotal} ${t.technicalControls} (${report.securityChecklist.scorePercent}%)`
        );
      }
      console.log(
        report.blocksPush
          ? `${ANSI.red}${t.pushBlockedMsg}${ANSI.reset}`
          : `${ANSI.green}${t.pushReadyMsg}${ANSI.reset}`
      );
      console.log('');
    }

    process.exitCode = report.blocksPush ? 1 : 0;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`${ANSI.red}Error ejecutando la ITV:${ANSI.reset} ${msg}`);
    process.exitCode = 2;
  }
}

void main();
