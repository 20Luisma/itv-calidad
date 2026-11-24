import { describe, expect, it } from 'vitest';
import { exportReportAsMarkdown } from '../src/application/ExportReportMarkdown.js';
import { STATION_CATALOG } from '../src/domain/catalog.js';
import { buildInspectionReport, createStationResult, resolveInspectionScope } from '../src/domain/report.js';
import type { RepoStack, StationId, StationResult, StationStatus } from '../src/domain/types.js';

function makeStation(id: StationId, status: StationStatus): StationResult {
  return createStationResult({
    metadata: STATION_CATALOG[id],
    command: 'test-cmd',
    status,
    durationMs: 10,
    summary: `status ${status}`,
    rawOutput: ''
  });
}

const sampleStack: RepoStack = {
  repoPath: '/tmp/sample',
  repoName: 'sample',
  primaryStack: 'node',
  detectedStacks: ['node'],
  hasTypeScript: false,
  hasPackageJson: false,
  hasComposerJson: false,
  hasPythonProject: false,
  hasPlaywright: false,
  hasAccessibilityTooling: false,
  packageScripts: {},
  composerScripts: {}
};

describe('resolveInspectionScope', () => {
  it('devuelve "full" cuando se verifican 6 o 7 estaciones incluyendo tests', () => {
    const stations: StationResult[] = [
      makeStation('syntax-config', 'pass'),
      makeStation('static-types', 'pass'),
      makeStation('tests-coverage', 'pass'),
      makeStation('security-cves', 'pass'),
      makeStation('e2e-browser', 'skipped'),
      makeStation('accessibility-ui', 'pass'),
      makeStation('code-health-observability', 'pass')
    ];

    const scope = resolveInspectionScope(stations);
    expect(scope.level).toBe('full');
    expect(scope.evaluatedStations).toBe(6);
    expect(scope.confidencePercent).toBe(86);
    expect(scope.missingCriticalLayers).toEqual(['Pruebas E2E']);
  });

  it('devuelve "partial" cuando hay tests o tipos pero faltan varias estaciones', () => {
    const stations: StationResult[] = [
      makeStation('syntax-config', 'pass'),
      makeStation('static-types', 'skipped'),
      makeStation('tests-coverage', 'pass'),
      makeStation('security-cves', 'pass'),
      makeStation('e2e-browser', 'skipped'),
      makeStation('accessibility-ui', 'skipped'),
      makeStation('code-health-observability', 'pass')
    ];

    const scope = resolveInspectionScope(stations);
    expect(scope.level).toBe('partial');
    expect(scope.evaluatedStations).toBe(4);
    expect(scope.missingCriticalLayers).toContain('Tipos estáticos');
  });

  it('devuelve "diagnostic-only" en proyectos desordenados sin tests ni tipado y lo incluye en Markdown', () => {
    const stations: StationResult[] = [
      makeStation('syntax-config', 'pass'),
      makeStation('static-types', 'skipped'),
      makeStation('tests-coverage', 'skipped'),
      makeStation('security-cves', 'pass'),
      makeStation('e2e-browser', 'skipped'),
      makeStation('accessibility-ui', 'pass'),
      makeStation('code-health-observability', 'pass')
    ];

    const report = buildInspectionReport({
      inspectionId: 'test-scope-1',
      startedAt: new Date('2026-11-24T00:00:00Z'),
      finishedAt: new Date('2026-11-24T00:00:02Z'),
      stack: sampleStack,
      stations
    });

    expect(report.scope?.level).toBe('diagnostic-only');
    expect(report.scope?.label).toBe('Solo diagnóstico estático');
    const md = exportReportAsMarkdown(report);
    expect(md).toContain('Alcance del diagnóstico:');
    expect(md).toContain('Solo diagnóstico estático');
  });
});
