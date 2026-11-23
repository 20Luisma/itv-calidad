#!/usr/bin/env node
import { exportReportAsMarkdown } from '../../application/ExportReportMarkdown.js';
import { RunItvInspection } from '../../application/RunItvInspection.js';
import type { InspectionEvent, StationStatus } from '../../domain/types.js';
import { SafeCommandExecutor } from '../../infrastructure/exec/SafeCommandExecutor.js';
import { createDefaultStations } from '../../infrastructure/stations/index.js';
import { parseCliArgs } from './parseArgs.js';

const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function formatStatus(status: StationStatus): string {
  switch (status) {
    case 'pass':
      return `${ANSI.green}● APTO${ANSI.reset}`;
    case 'warn':
      return `${ANSI.yellow}▲ OBSERVACIÓN${ANSI.reset}`;
    case 'fail':
      return `${ANSI.red}✖ DESFAVORABLE${ANSI.reset}`;
    case 'skipped':
      return `${ANSI.dim}○ OMITIDA${ANSI.reset}`;
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
  --help, -h           Muestra esta ayuda
`);
}

async function main(): Promise<void> {
  const options = parseCliArgs(process.argv.slice(2), process.cwd());
  if (options.showHelp) {
    printHelp();
    return;
  }

  const executor = new SafeCommandExecutor();
  const runner = new RunItvInspection(createDefaultStations(), executor);

  const onEvent = (event: InspectionEvent) => {
    if (options.format !== 'pretty') return;

    if (event.type === 'inspection:start') {
      console.log('');
      console.log(`${ANSI.bold}${ANSI.cyan}═══ ITV DE CÓDIGO ═══${ANSI.reset}`);
      console.log(`Repositorio : ${event.stack.repoName} (${event.stack.repoPath})`);
      console.log(
        `Stack       : ${event.stack.detectedStacks.join(', ')} (principal: ${event.stack.primaryStack})${event.stack.gitBranch ? ` · rama ${event.stack.gitBranch}` : ''}`
      );
      console.log(`Cámara lenta: ${event.slowMotionMs} ms por estación`);
      console.log('');
    } else if (event.type === 'station:start') {
      console.log(`${ANSI.bold}▶ ${event.station.name}${ANSI.reset}`);
      console.log(`  ${ANSI.dim}${event.station.didactic.whatItChecks}${ANSI.reset}`);
    } else if (event.type === 'station:complete') {
      const r = event.result;
      console.log(`  Estado  : ${formatStatus(r.status)} ${ANSI.dim}(${r.durationMs} ms)${ANSI.reset}`);
      console.log(`  Comando : ${ANSI.dim}${r.command}${ANSI.reset}`);
      console.log(`  Resumen : ${r.summary}`);

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
        console.log(`      ${ANSI.dim}Motivo: ${finding.reason}${ANSI.reset}`);
        console.log(`      ${ANSI.dim}Arreglo: ${finding.howToFix}${ANSI.reset}`);
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
      console.log(exportReportAsMarkdown(report));
    } else {
      const verdictColor =
        report.verdict === 'DESFAVORABLE'
          ? ANSI.red
          : report.verdict === 'APTO_CON_OBSERVACIONES'
            ? ANSI.yellow
            : ANSI.green;

      console.log(`${ANSI.bold}═══ VEREDICTO FINAL ═══${ANSI.reset}`);
      console.log(`Resultado : ${verdictColor}${ANSI.bold}${report.verdict}${ANSI.reset}`);
      console.log(
        `Estaciones: ${report.summary.passed} aptas · ${report.summary.warned} observaciones · ${report.summary.failed} desfavorables · ${report.summary.skipped} omitidas`
      );
      if (report.securityChecklist) {
        console.log(
          `Checklist : ${report.securityChecklist.automatedPassed}/${report.securityChecklist.automatedTotal} controles técnicos de diligencia debida (${report.securityChecklist.scorePercent}%)`
        );
      }
      console.log(
        report.blocksPush
          ? `${ANSI.red}✖ PUSH BLOQUEADO: corregí las estaciones desfavorables antes de subir.${ANSI.reset}`
          : `${ANSI.green}✔ APTO PARA GIT PUSH.${ANSI.reset}`
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
