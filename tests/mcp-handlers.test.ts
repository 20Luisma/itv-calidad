import { describe, it, expect, vi } from 'vitest';
import type { InspectionReport } from '../src/domain/types.js';
import {
  handleListStations,
  handleRunItv,
  handleSecurityChecklist,
  type InspectionRunner
} from '../src/interfaces/mcp/handlers.js';

const mockReport: InspectionReport = {
  inspectionId: 'insp-test-1',
  verdict: 'APTO',
  blocksPush: false,
  startedAt: '2026-11-23T22:00:00.000Z',
  finishedAt: '2026-11-23T22:00:02.000Z',
  totalDurationMs: 2000,
  stack: {
    repoPath: '/tmp/demo',
    repoName: 'demo',
    primaryStack: 'node',
    detectedStacks: ['node'],
    hasPackageJson: true,
    hasComposerJson: false,
    hasPythonProject: false,
    hasTypeScript: true,
    hasPlaywright: true,
    hasAccessibilityTooling: false,
    packageScripts: { test: 'vitest run' },
    composerScripts: {},
    gitBranch: 'main'
  },
  summary: { total: 7, passed: 7, warned: 0, failed: 0, skipped: 0 },
  stations: [
    {
      id: 'security-cves',
      order: 4,
      name: 'Estación 4 — Seguridad y Dependencias (CVEs)',
      shortName: 'Seguridad y CVEs',
      didacticExplanation: 'Audita CVEs y secretos',
      whyItMatters: 'Seguridad',
      status: 'pass',
      durationMs: 120,
      command: 'npm audit',
      summary: '0 CVEs y 0 secretos',
      rawOutput: '',
      findings: []
    }
  ],
  securityChecklist: {
    generatedAt: '2026-11-23T22:00:02.000Z',
    disclaimer: 'Guía técnica OWASP ASVS / RGPD Art. 32',
    automatedPassed: 6,
    automatedTotal: 6,
    scorePercent: 100,
    items: []
  }
};

describe('MCP Handlers (itv-calidad)', () => {
  it('lists all 7 ITV stations with didactic metadata', () => {
    const res = handleListStations();
    const parsed = JSON.parse(res.content[0]!.text);
    expect(parsed.totalStations).toBe(7);
    expect(parsed.stations[0].order).toBe(1);
  });

  it('runs ITV inspection and formats both JSON and Markdown responses', async () => {
    const runner: InspectionRunner = {
      execute: vi.fn().mockResolvedValue(mockReport)
    };

    const jsonRes = await handleRunItv({ repoPath: '/tmp/demo' }, runner);
    expect(jsonRes.isError).toBeUndefined();
    const parsed = JSON.parse(jsonRes.content[0]!.text);
    expect(parsed.verdict).toBe('APTO');
    expect(parsed.blocksPush).toBe(false);

    const mdRes = await handleRunItv({ repoPath: '/tmp/demo', format: 'markdown', minCoverage: 80 }, runner);
    expect(mdRes.content[0]!.text).toContain('# Informe ITV de Código');
  });

  it('returns OWASP security checklist and handles errors fail-safely', async () => {
    const okRunner: InspectionRunner = {
      execute: vi.fn().mockResolvedValue(mockReport)
    };
    const res = await handleSecurityChecklist({ repoPath: '/tmp/demo' }, okRunner);
    const parsed = JSON.parse(res.content[0]!.text);
    expect(parsed.checklist.scorePercent).toBe(100);
    expect(parsed.securityStation.status).toBe('pass');

    const failRunner: InspectionRunner = {
      execute: vi.fn().mockRejectedValue(new Error('Ruta no encontrada'))
    };
    const errRes = await handleRunItv({ repoPath: '/no-existe' }, failRunner);
    expect(errRes.isError).toBe(true);
    expect(errRes.content[0]!.text).toContain('Ruta no encontrada');

    const secErr = await handleSecurityChecklist({ repoPath: '/no-existe' }, failRunner);
    expect(secErr.isError).toBe(true);
  });
});
