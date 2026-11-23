import { STATION_CATALOG } from '../../domain/catalog.js';
import { createStationResult } from '../../domain/report.js';
import type {
  ExternalIntegrationLink,
  Finding,
  StationContext,
  StationResult,
  StationRunner
} from '../../domain/types.js';
import { queryGitHubSecurity } from '../integrations/GitHubSecurityClient.js';
import { querySentryIssues } from '../integrations/SentryApiClient.js';
import { querySonarCloud } from '../integrations/SonarCloudClient.js';
import { scanCodeHealthSonar } from '../scanners/CodeHealthSonarScanner.js';
import { scanObservabilitySentry } from '../scanners/ObservabilitySentryScanner.js';

export interface CodeHealthStationDeps {
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly fetchImpl?: typeof fetch;
}

export class CodeHealthObservabilityStation implements StationRunner {
  readonly metadata = STATION_CATALOG['code-health-observability'];

  constructor(private readonly deps: CodeHealthStationDeps = {}) {}

  async run(context: StationContext): Promise<StationResult> {
    const startedAt = Date.now();
    const { repoPath, stack } = context;

    const clientOpts = {
      ...(this.deps.env ? { env: this.deps.env } : {}),
      ...(this.deps.fetchImpl ? { fetchImpl: this.deps.fetchImpl } : {})
    };

    const [sonar, sentry, sonarCloud, sentryApi, githubSec] = await Promise.all([
      scanCodeHealthSonar(repoPath),
      scanObservabilitySentry(repoPath, stack),
      querySonarCloud(repoPath, clientOpts),
      querySentryIssues(clientOpts),
      queryGitHubSecurity(repoPath, clientOpts)
    ]);

    const externalLinks: ExternalIntegrationLink[] = [];
    if (sonarCloud.link) externalLinks.push(sonarCloud.link);
    if (sentryApi.link) externalLinks.push(sentryApi.link);
    if (githubSec.link) externalLinks.push(githubSec.link);

    const findings: Finding[] = [
      ...sonar.findings,
      ...sentry.findings,
      ...sonarCloud.findings,
      ...sentryApi.findings,
      ...githubSec.findings
    ];
    const hasErrors = findings.some((f) => f.severity === 'error');
    const hasWarnings = findings.some((f) => f.severity === 'warning');

    if (sonar.filesAnalyzed === 0 && externalLinks.length === 0) {
      return createStationResult({
        metadata: this.metadata,
        command: 'Escáner local deuda técnica + observabilidad (0 archivos fuente)',
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
      ? `Se detectaron ${errorCount} fallo(s) bloqueante(s) de calidad u observabilidad.`
      : hasWarnings
        ? `Analizados ${sonar.filesAnalyzed} archivo(s) con ${warningCount} aviso(s) de deuda técnica u observabilidad.`
        : `Calidad técnica limpia (${sonar.filesAnalyzed} archivo(s), 0 duplicados) y observabilidad sin fugas.`;

    const outputLines = [
      `Análisis local deuda técnica: ${sonar.filesAnalyzed} archivo(s) · ${sonar.duplicateBlocks} bloque(s) duplicado(s) · sonar-project.properties: ${sonar.hasSonarConfig ? 'sí' : 'no'}.`,
      `Observabilidad estática: ${sentry.sentryDetected ? 'Sentry detectado' : sentry.hasObservability ? 'Handlers/logs detectados' : 'Sin SDK ni handlers globales detectados'}.`,
      ...(sonarCloud.logLine ? [sonarCloud.logLine] : []),
      ...(sentryApi.logLine ? [sentryApi.logLine] : []),
      ...(githubSec.logLine ? [githubSec.logLine] : [])
    ];

    const cmdParts = [`análisis local (${sonar.filesAnalyzed} archivos)`];
    if (sonarCloud.link?.status === 'connected') cmdParts.push('SonarCloud API');
    if (sentryApi.link?.status === 'connected') cmdParts.push('Sentry API');
    if (githubSec.link?.status === 'connected') cmdParts.push('GitHub Security API');

    const connectedNames: string[] = [];
    if (sonarCloud.link?.status === 'connected') connectedNames.push('Sonar');
    if (sentryApi.link?.status === 'connected') connectedNames.push('Sentry');
    if (githubSec.link?.status === 'connected') connectedNames.push('GitHub');

    const dynamicMetadata =
      connectedNames.length > 0
        ? {
            ...this.metadata,
            shortName: connectedNames.join(' · ')
          }
        : this.metadata;

    return createStationResult({
      metadata: dynamicMetadata,
      command: cmdParts.join(' && '),
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
      },
      ...(externalLinks.length > 0 ? { externalLinks } : {})
    });
  }
}
