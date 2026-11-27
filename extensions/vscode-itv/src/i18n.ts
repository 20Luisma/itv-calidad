import * as vscode from 'vscode';
import type { StationStatus } from '../../../src/domain/types.js';

export type UiLocale = 'en' | 'es';

export function detectLocale(explicitLang?: string): UiLocale {
  const raw = (explicitLang ?? vscode.env?.language ?? 'en').toLowerCase();
  return raw.startsWith('es') ? 'es' : 'en';
}

export interface UiStrings {
  readonly htmlLang: UiLocale;
  readonly appTitle: string;
  readonly subtitle: string;
  readonly trafficAria: string;
  readonly runBtn: string;
  readonly stopBtn: string;
  readonly exportBtn: string;
  readonly integrationsBtn: string;
  readonly integrationsHint: string;
  readonly githubTokenLabel: string;
  readonly saveEncryptedBtn: string;
  readonly closeBtn: string;
  readonly savedMsg: string;
  readonly connectedPill: string;
  readonly readyStatus: string;
  readonly startingStatus: string;
  readonly runningStationPrefix: string;
  readonly completedInPrefix: string;
  readonly blockingFailSub: string;
  readonly noBlockingSub: string;
  readonly kpiPassed: string;
  readonly kpiScope: string;
  readonly kpiChecklist: string;
  readonly kpiTime: string;
  readonly openFolderLabel: string;
  readonly statusBarTooltip: string;
  readonly statusBarScanning: string;
  readonly statusBarStopped: string;
  readonly statusBarFail: string;
  readonly statusBarPass: string;
  readonly statusBarWarn: string;
  readonly alreadyRunningWarn: string;
  readonly runFirstToExportInfo: string;
  readonly integrationsSavedPrefix: string;
  readonly integrationsActiveSuffix: string;
  readonly howToFixLabel: string;
  readonly openFindingTitle: string;
  readonly defaultError: string;
  readonly stateLabels: Record<'idle' | 'running' | StationStatus, string>;
  readonly stationNames: Record<string, string>;
  readonly verdicts: Record<string, string>;
}

const STRINGS: Record<UiLocale, UiStrings> = {
  en: {
    htmlLang: 'en',
    appTitle: 'ITV Code Gate',
    subtitle: '7 stations · 100% local',
    trafficAria: 'ITV traffic light',
    runBtn: 'Run ITV',
    stopBtn: 'Stop',
    exportBtn: 'Export .md',
    integrationsBtn: '⚙ Integrations',
    integrationsHint: 'Tokens are stored in your OS encrypted keychain (SecretStorage). Optional.',
    githubTokenLabel: 'GITHUB_TOKEN (optional)',
    saveEncryptedBtn: 'Save encrypted',
    closeBtn: 'Close',
    savedMsg: 'Saved in the IDE encrypted keychain.',
    connectedPill: 'Connected',
    readyStatus: 'Ready to inspect the open workspace.',
    startingStatus: 'Starting 7-station inspection…',
    runningStationPrefix: 'Running ',
    completedInPrefix: 'Completed in ',
    blockingFailSub: 'Blocking failures found before git push.',
    noBlockingSub: 'No blocking failures. Review details below.',
    kpiPassed: 'Passed',
    kpiScope: 'Verified scope',
    kpiChecklist: 'OWASP Checklist',
    kpiTime: 'Duration',
    openFolderLabel: 'Inspect repository with ITV Code Gate',
    statusBarTooltip: 'Run ITV Code Gate (7 stations)',
    statusBarScanning: '$(sync~spin) ITV: Scanning…',
    statusBarStopped: '$(shield) ITV: Stopped',
    statusBarFail: 'FAIL',
    statusBarPass: 'PASS',
    statusBarWarn: 'warnings',
    alreadyRunningWarn: 'An ITV inspection is already running.',
    runFirstToExportInfo: 'Run an ITV inspection first to export the Markdown report.',
    integrationsSavedPrefix: 'ITV Code Gate: integrations saved (',
    integrationsActiveSuffix: ' active).',
    howToFixLabel: 'How to fix',
    openFindingTitle: 'Open finding',
    defaultError: 'Error running ITV inspection.',
    stateLabels: {
      pass: 'PASS',
      warn: 'WARNING',
      fail: 'FAIL',
      skipped: 'SKIPPED',
      running: 'Scanning…',
      idle: 'Pending'
    },
    stationNames: {
      'syntax-config': 'Syntax & Config',
      'static-types': 'Static Types',
      'tests-coverage': 'Tests & Coverage',
      'security-cves': 'Security, CVEs & OWASP',
      'e2e-browser': 'Browser E2E',
      'accessibility-ui': 'WCAG 2.1 AA UI',
      'code-health-observability': 'Code Health & Observability'
    },
    verdicts: {
      APTO: 'PASS — READY TO PUSH',
      APTO_CON_OBSERVACIONES: 'PASS WITH WARNINGS',
      DESFAVORABLE: 'FAIL — BLOCKS PUSH'
    }
  },
  es: {
    htmlLang: 'es',
    appTitle: 'ITV de Código',
    subtitle: '7 estaciones · 100% local',
    trafficAria: 'Semáforo ITV',
    runBtn: 'Pasar ITV',
    stopBtn: 'Detener',
    exportBtn: 'Exportar .md',
    integrationsBtn: '⚙ Integraciones',
    integrationsHint: 'Tokens guardados en el almacén cifrado de tu sistema operativo (SecretStorage). Opcional.',
    githubTokenLabel: 'GITHUB_TOKEN (opcional)',
    saveEncryptedBtn: 'Guardar cifrado',
    closeBtn: 'Cerrar',
    savedMsg: 'Guardado en el llavero cifrado del IDE.',
    connectedPill: 'Conectado',
    readyStatus: 'Lista para inspeccionar el workspace abierto.',
    startingStatus: 'Iniciando inspección de 7 estaciones…',
    runningStationPrefix: 'Ejecutando ',
    completedInPrefix: 'Completada en ',
    blockingFailSub: 'Hay fallos bloqueantes antes de hacer git push.',
    noBlockingSub: 'Sin fallos bloqueantes. Revisa los detalles abajo.',
    kpiPassed: 'Aptas',
    kpiScope: 'Alcance verificado',
    kpiChecklist: 'Checklist OWASP',
    kpiTime: 'Tiempo',
    openFolderLabel: 'Inspeccionar repositorio con ITV',
    statusBarTooltip: 'Pasar ITV de Código (7 estaciones)',
    statusBarScanning: '$(sync~spin) ITV: Escaneando…',
    statusBarStopped: '$(shield) ITV: Detenida',
    statusBarFail: 'DESFAVORABLE',
    statusBarPass: 'APTO',
    statusBarWarn: 'avisos',
    alreadyRunningWarn: 'Ya hay una inspección ITV en curso.',
    runFirstToExportInfo: 'Primero ejecuta una inspección ITV para exportar evidencia.',
    integrationsSavedPrefix: 'ITV de Código: integraciones guardadas (',
    integrationsActiveSuffix: ' activas).',
    howToFixLabel: 'Cómo arreglarlo',
    openFindingTitle: 'Abrir hallazgo',
    defaultError: 'Error al ejecutar ITV.',
    stateLabels: {
      pass: 'APTO',
      warn: 'OBSERVACIÓN',
      fail: 'DESFAVORABLE',
      skipped: 'OMITIDA',
      running: 'Escaneando…',
      idle: 'Pendiente'
    },
    stationNames: {},
    verdicts: {
      APTO: 'APTO',
      APTO_CON_OBSERVACIONES: 'APTO CON OBSERVACIONES',
      DESFAVORABLE: 'DESFAVORABLE'
    }
  }
};

export function getUiStrings(locale: UiLocale = detectLocale()): UiStrings {
  return STRINGS[locale];
}

export function localizedStationName(stationId: string, fallback: string, strings: UiStrings): string {
  return strings.stationNames[stationId] ?? fallback;
}
