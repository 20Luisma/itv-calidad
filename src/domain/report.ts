import type {
  ExternalIntegrationLink,
  Finding,
  InspectionReport,
  InspectionScope,
  InspectionSummary,
  InspectionVerdict,
  RepoStack,
  SecurityChecklistReport,
  StationMetadata,
  StationResult,
  StationStatus
} from './types.js';

export function buildInspectionSummary(stations: readonly StationResult[]): InspectionSummary {
  let passed = 0;
  let warned = 0;
  let failed = 0;
  let skipped = 0;

  for (const station of stations) {
    switch (station.status) {
      case 'pass':
        passed += 1;
        break;
      case 'warn':
        warned += 1;
        break;
      case 'fail':
        failed += 1;
        break;
      case 'skipped':
        skipped += 1;
        break;
    }
  }

  return {
    total: stations.length,
    passed,
    warned,
    failed,
    skipped
  };
}

export function resolveVerdict(summary: InspectionSummary): {
  verdict: InspectionVerdict;
  blocksPush: boolean;
} {
  if (summary.failed > 0) {
    return { verdict: 'DESFAVORABLE', blocksPush: true };
  }
  if (summary.warned > 0) {
    return { verdict: 'APTO_CON_OBSERVACIONES', blocksPush: false };
  }
  return { verdict: 'APTO', blocksPush: false };
}

export function resolveInspectionScope(stations: readonly StationResult[]): InspectionScope {
  const totalStations = stations.length;
  const evaluatedStations = stations.filter((s) => s.status !== 'skipped').length;
  const confidencePercent =
    totalStations > 0 ? Math.round((evaluatedStations / totalStations) * 100) : 0;

  const missingCriticalLayers: string[] = [];
  const typesStation = stations.find((s) => s.id === 'static-types');
  const testsStation = stations.find((s) => s.id === 'tests-coverage');
  const e2eStation = stations.find((s) => s.id === 'e2e-browser');

  const missingTypes = !typesStation || typesStation.status === 'skipped';
  const missingTests = !testsStation || testsStation.status === 'skipped';
  const missingE2e = !e2eStation || e2eStation.status === 'skipped';

  if (missingTypes) missingCriticalLayers.push('Tipos estáticos');
  if (missingTests) missingCriticalLayers.push('Tests automáticos');
  if (missingE2e) missingCriticalLayers.push('Pruebas E2E');

  if (evaluatedStations < 3 || (missingTests && missingTypes)) {
    return {
      level: 'diagnostic-only',
      label: 'Solo diagnóstico estático',
      evaluatedStations,
      totalStations,
      confidencePercent,
      missingCriticalLayers,
      note: 'Se auditó sintaxis y seguridad estática, pero faltan tests y tipado para certificar preparación para producción.'
    };
  }

  if (evaluatedStations >= 6 && !missingTests) {
    return {
      level: 'full',
      label: 'Inspección completa',
      evaluatedStations,
      totalStations,
      confidencePercent,
      missingCriticalLayers,
      note: 'Cobertura completa de estaciones verificadas antes del push.'
    };
  }

  return {
    level: 'partial',
    label: 'Inspección parcial',
    evaluatedStations,
    totalStations,
    confidencePercent,
    missingCriticalLayers,
    note:
      missingCriticalLayers.length > 0
        ? `Alcance parcial (${evaluatedStations}/${totalStations} verificadas). Capas no verificadas: ${missingCriticalLayers.join(', ')}.`
        : `Alcance parcial (${evaluatedStations}/${totalStations} estaciones verificadas).`
  };
}

export function buildInspectionReport(params: {
  inspectionId: string;
  startedAt: Date;
  finishedAt: Date;
  stack: RepoStack;
  stations: readonly StationResult[];
}): InspectionReport {
  const summary = buildInspectionSummary(params.stations);
  const { verdict, blocksPush } = resolveVerdict(summary);
  const scope = resolveInspectionScope(params.stations);
  const totalDurationMs = Math.max(0, params.finishedAt.getTime() - params.startedAt.getTime());

  const securityChecklist = params.stations.find((s) => s.securityChecklist)?.securityChecklist;

  const base: InspectionReport = {
    inspectionId: params.inspectionId,
    startedAt: params.startedAt.toISOString(),
    finishedAt: params.finishedAt.toISOString(),
    totalDurationMs,
    verdict,
    blocksPush,
    stack: params.stack,
    summary,
    scope,
    stations: params.stations
  };

  if (securityChecklist) {
    return { ...base, securityChecklist };
  }
  return base;
}

export function createStationResult(params: {
  metadata: StationMetadata;
  command: string;
  status: StationStatus;
  durationMs: number;
  summary: string;
  rawOutput: string;
  findings?: readonly Finding[];
  metrics?: Readonly<Record<string, number | string>>;
  securityChecklist?: SecurityChecklistReport;
  externalLinks?: readonly ExternalIntegrationLink[];
}): StationResult {
  const base: StationResult = {
    id: params.metadata.id,
    order: params.metadata.order,
    name: params.metadata.name,
    shortName: params.metadata.shortName,
    didacticExplanation: params.metadata.didactic.whatItChecks,
    whyItMatters: params.metadata.didactic.whyItMatters,
    command: params.command,
    status: params.status,
    durationMs: Math.max(0, Math.round(params.durationMs)),
    summary: params.summary,
    rawOutput: params.rawOutput,
    findings: params.findings ?? []
  };

  return {
    ...base,
    ...(params.metrics && Object.keys(params.metrics).length > 0 ? { metrics: params.metrics } : {}),
    ...(params.securityChecklist ? { securityChecklist: params.securityChecklist } : {}),
    ...(params.externalLinks && params.externalLinks.length > 0
      ? { externalLinks: params.externalLinks }
      : {})
  };
}
