import { STATION_CATALOG } from '../../domain/catalog.js';
import { createStationResult } from '../../domain/report.js';
import type { Finding, StationContext, StationResult, StationRunner } from '../../domain/types.js';
import { scanCodeHealthSonar } from '../scanners/CodeHealthSonarScanner.js';
import { scanObservabilitySentry } from '../scanners/ObservabilitySentryScanner.js';

export class CodeHealthObservabilityStation implements StationRunner {
  readonly metadata = STATION_CATALOG['code-health-observability'];

  async run(context: StationContext): Promise<StationResult> {
    const startedAt = Date.now();
    const { repoPath, stack } = context;

    const [sonar, sentry] = await Promise.all([
      scanCodeHealthSonar(repoPath),
      scanObservabilitySentry(repoPath, stack)
    ]);

    const findings: Finding[] = [...sonar.findings, ...sentry.findings];
    const hasErrors = findings.some((f) => f.severity === 'error');
    const hasWarnings = findings.some((f) => f.severity === 'warning');

    if (sonar.filesAnalyzed === 0) {
      return createStationResult({
        metadata: this.metadata,
        command: 'Escáner local Sonar + Observabilidad Sentry (0 archivos fuente)',
        status: 'skipped',
        durationMs: Date.now() - startedAt,
        summary: 'No se encontraron archivos fuente PHP, JS/TS ni Python para analizar deuda técnica.',
        rawOutput: 'Estación omitida limpiamente.'
      });
    }

    const status = hasErrors ? 'fail' : hasWarnings ? 'warn' : 'pass';
    const warningCount = findings.filter((f) => f.severity === 'warning').length;
    const errorCount = findings.filter((f) => f.severity === 'error').length;

    const summary = hasErrors
      ? `Se detectaron ${errorCount} fallo(s) bloqueante(s) de calidad u observabilidad (debugger o Sentry DSN hardcodeado).`
      : hasWarnings
        ? `Calidad analizada en ${sonar.filesAnalyzed} archivo(s) con ${warningCount} aviso(s) de deuda técnica u observabilidad.`
        : `Calidad técnica limpia (${sonar.filesAnalyzed} archivo(s), 0 duplicados) y sin fugas de observabilidad.`;

    const outputLines = [
      `Mini-Sonar local: ${sonar.filesAnalyzed} archivo(s) analizado(s) · ${sonar.duplicateBlocks} bloque(s) duplicado(s) · sonar-project.properties: ${sonar.hasSonarConfig ? 'sí' : 'no'}.`,
      `Observabilidad / Sentry: ${sentry.sentryDetected ? 'Sentry detectado' : sentry.hasObservability ? 'Handlers/logs detectados' : 'Sin SDK ni handlers globales detectados'}.`
    ];

    return createStationResult({
      metadata: this.metadata,
      command: `mini-sonar local (${sonar.filesAnalyzed} archivos) && auditoría observabilidad/Sentry`,
      status,
      durationMs: Date.now() - startedAt,
      summary,
      rawOutput: outputLines.join('\n'),
      findings,
      metrics: {
        filesAnalyzed: sonar.filesAnalyzed,
        duplicateBlocks: sonar.duplicateBlocks,
        observability: sentry.sentryDetected
          ? 'Sentry'
          : sentry.hasObservability
            ? 'Logs/Handlers'
            : 'Sin configurar'
      }
    });
  }
}
