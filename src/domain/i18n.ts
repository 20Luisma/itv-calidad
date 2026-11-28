import type { InspectionVerdict, StationId, StationStatus } from './types.js';

export type SupportedLang = 'es' | 'en';

export function resolveLang(explicit?: string, fallbackEnv?: string): SupportedLang {
  const candidate = (explicit ?? fallbackEnv ?? 'es').trim().toLowerCase();
  if (candidate.startsWith('en')) return 'en';
  return 'es';
}

export interface CoreLabels {
  readonly reportTitle: string;
  readonly verdict: string;
  readonly blocksPush: string;
  readonly readyToPush: string;
  readonly date: string;
  readonly repository: string;
  readonly gitBranch: string;
  readonly detectedStack: string;
  readonly primary: string;
  readonly totalDuration: string;
  readonly summary: string;
  readonly summaryCounts: (p: number, w: number, f: number, s: number) => string;
  readonly diagnosticScope: string;
  readonly verified: string;
  readonly resultsByStation: string;
  readonly whatItChecks: string;
  readonly command: string;
  readonly time: string;
  readonly externalPanels: string;
  readonly findings: string;
  readonly howToFix: string;
  readonly checklistTitle: string;
  readonly automatedPassed: string;
  readonly checklistTableHeader: string;
  readonly automated: string;
  readonly operational: string;
  readonly cliBanner: string;
  readonly slowMotion: string;
  readonly perStation: string;
  readonly branchWord: string;
  readonly statusLabel: string;
  readonly reasonLabel: string;
  readonly fixLabel: string;
  readonly finalVerdict: string;
  readonly resultLabel: string;
  readonly stationsLabel: string;
  readonly checklistLabel: string;
  readonly technicalControls: string;
  readonly pushBlockedMsg: string;
  readonly pushReadyMsg: string;
  readonly idleCockpitMsg: (defaultPath: string) => string;
  readonly statusBadges: Record<StationStatus, string>;
  readonly verdicts: Record<InspectionVerdict, string>;
  readonly stationNames: Partial<Record<StationId, string>>;
}

const LABELS: Record<SupportedLang, CoreLabels> = {
  es: {
    reportTitle: 'Informe ITV de Código',
    verdict: 'Veredicto',
    blocksPush: 'BLOQUEA PUSH',
    readyToPush: 'APTO PARA PUSH',
    date: 'Fecha',
    repository: 'Repositorio',
    gitBranch: 'Rama Git',
    detectedStack: 'Stack detectado',
    primary: 'principal',
    totalDuration: 'Duración total',
    summary: 'Resumen',
    summaryCounts: (p, w, f, s) =>
      `${p} aptas · ${w} observaciones · ${f} desfavorables · ${s} omitidas`,
    diagnosticScope: 'Alcance del diagnóstico',
    verified: 'verificadas',
    resultsByStation: 'Resultado por Estación',
    whatItChecks: 'Qué revisa',
    command: 'Comando',
    time: 'Tiempo',
    externalPanels: 'Paneles externos',
    findings: 'Hallazgos',
    howToFix: 'Cómo arreglarlo',
    checklistTitle: 'Checklist de Tranquilidad / Diligencia Debida en Seguridad',
    automatedPassed: 'Controles automáticos superados',
    checklistTableHeader: '| Estado | Tipo | Control | Referencia | Detalle |',
    automated: 'Automático',
    operational: 'Operativo/Legal',
    cliBanner: '═══ ITV DE CÓDIGO ═══',
    slowMotion: 'Cámara lenta',
    perStation: 'ms por estación',
    branchWord: 'rama',
    statusLabel: 'Estado',
    reasonLabel: 'Motivo',
    fixLabel: 'Arreglo',
    finalVerdict: '═══ VEREDICTO FINAL ═══',
    resultLabel: 'Resultado',
    stationsLabel: 'Estaciones',
    checklistLabel: 'Checklist',
    technicalControls: 'controles técnicos de diligencia debida',
    pushBlockedMsg: '✖ PUSH BLOQUEADO: corrige las estaciones desfavorables antes de subir.',
    pushReadyMsg: '✔ APTO PARA GIT PUSH.',
    idleCockpitMsg: (p) =>
      `Cabina ITV de Código abierta. Indica una ruta local de repositorio (por ejemplo: ${p}) para iniciar las 7 estaciones.`,
    statusBadges: {
      pass: 'APTO',
      warn: 'OBSERVACION',
      fail: 'DESFAVORABLE',
      skipped: 'OMITIDA'
    },
    verdicts: {
      APTO: 'APTO',
      APTO_CON_OBSERVACIONES: 'APTO_CON_OBSERVACIONES',
      DESFAVORABLE: 'DESFAVORABLE'
    },
    stationNames: {}
  },
  en: {
    reportTitle: 'ITV Code Gate Report',
    verdict: 'Verdict',
    blocksPush: 'BLOCKS PUSH',
    readyToPush: 'READY FOR PUSH',
    date: 'Date',
    repository: 'Repository',
    gitBranch: 'Git Branch',
    detectedStack: 'Detected Stack',
    primary: 'primary',
    totalDuration: 'Total Duration',
    summary: 'Summary',
    summaryCounts: (p, w, f, s) =>
      `${p} passed · ${w} warnings · ${f} failed · ${s} skipped`,
    diagnosticScope: 'Diagnostic Scope',
    verified: 'verified',
    resultsByStation: 'Results by Station',
    whatItChecks: 'What it checks',
    command: 'Command',
    time: 'Duration',
    externalPanels: 'External Dashboards',
    findings: 'Findings',
    howToFix: 'How to fix',
    checklistTitle: 'Security Due Diligence Checklist (OWASP ASVS / GDPR Art. 32)',
    automatedPassed: 'Automated checks passed',
    checklistTableHeader: '| Status | Type | Control | Reference | Detail |',
    automated: 'Automated',
    operational: 'Operational/Legal',
    cliBanner: '═══ ITV CODE GATE ═══',
    slowMotion: 'Slow motion',
    perStation: 'ms per station',
    branchWord: 'branch',
    statusLabel: 'Status',
    reasonLabel: 'Reason',
    fixLabel: 'Fix',
    finalVerdict: '═══ FINAL VERDICT ═══',
    resultLabel: 'Result',
    stationsLabel: 'Stations',
    checklistLabel: 'Checklist',
    technicalControls: 'automated security due diligence controls',
    pushBlockedMsg: '✖ PUSH BLOCKED: fix failing stations before pushing.',
    pushReadyMsg: '✔ READY FOR GIT PUSH.',
    idleCockpitMsg: (p) =>
      `ITV Code Gate cockpit is open. Provide a local repository path (e.g. ${p}) to run all 7 stations.`,
    statusBadges: {
      pass: 'PASS',
      warn: 'WARNING',
      fail: 'FAIL',
      skipped: 'SKIPPED'
    },
    verdicts: {
      APTO: 'PASS',
      APTO_CON_OBSERVACIONES: 'PASS WITH WARNINGS',
      DESFAVORABLE: 'FAIL'
    },
    stationNames: {
      'syntax-config': 'Station 1 — Syntax & Configuration',
      'static-types': 'Station 2 — Static Type Analysis',
      'tests-coverage': 'Station 3 — Automated Tests & Coverage',
      'security-cves': 'Station 4 — Security, CVEs & OWASP',
      'e2e-browser': 'Station 5 — Browser E2E Tests',
      'accessibility-ui': 'Station 6 — WCAG 2.1 AA Accessibility & UI',
      'code-health-observability': 'Station 7 — Code Health & Observability'
    }
  }
};

export function getCoreLabels(lang: SupportedLang = 'es'): CoreLabels {
  return LABELS[lang];
}

export function getLocalizedStationName(id: StationId, fallback: string, lang: SupportedLang): string {
  return LABELS[lang].stationNames[id] ?? fallback;
}
