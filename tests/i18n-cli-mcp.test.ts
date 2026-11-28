import { describe, expect, it } from 'vitest';
import { exportReportAsMarkdown } from '../src/application/ExportReportMarkdown.js';
import { STATION_CATALOG } from '../src/domain/catalog.js';
import { getCoreLabels, getLocalizedStationName, resolveLang } from '../src/domain/i18n.js';
import { buildInspectionReport, createStationResult } from '../src/domain/report.js';
import type { RepoStack } from '../src/domain/types.js';
import { parseCliArgs } from '../src/interfaces/cli/parseArgs.js';
import { handleRunItv } from '../src/interfaces/mcp/handlers.js';

const MOCK_STACK: RepoStack = {
  repoPath: '/tmp/demo',
  repoName: 'demo',
  primaryStack: 'node',
  detectedStacks: ['node'],
  hasTypeScript: true,
  hasPackageJson: true,
  hasComposerJson: false,
  hasPythonProject: false,
  hasPlaywright: false,
  hasAccessibilityTooling: false,
  packageScripts: {},
  composerScripts: {}
};

describe('Soporte i18n EN/ES en CLI, Markdown y MCP (#1)', () => {
  it('resuelve correctamente idioma explícito y por defecto', () => {
    expect(resolveLang('en')).toBe('en');
    expect(resolveLang('en-US')).toBe('en');
    expect(resolveLang('es')).toBe('es');
    expect(resolveLang(undefined, 'en_US.UTF-8')).toBe('en');
    expect(resolveLang(undefined, undefined)).toBe('es');
    expect(getLocalizedStationName('security-cves', 'fallback', 'en')).toContain('Station 4');
    expect(getCoreLabels('en').readyToPush).toBe('READY FOR PUSH');
  });

  it('exporta reporte Markdown en inglés y parsea --lang en en CLI y MCP', async () => {
    const stations = Object.values(STATION_CATALOG)
      .sort((a, b) => a.order - b.order)
      .map((meta) =>
        createStationResult({
          metadata: meta,
          command: 'ok',
          status: 'pass',
          durationMs: 10,
          summary: 'OK',
          rawOutput: ''
        })
      );
    const now = new Date();
    const report = buildInspectionReport({
      inspectionId: 'test-i18n',
      startedAt: now,
      finishedAt: now,
      stack: MOCK_STACK,
      stations
    });

    const mdEn = exportReportAsMarkdown(report, 'en');
    expect(mdEn).toContain('# ITV Code Gate Report — demo');
    expect(mdEn).toContain('READY FOR PUSH');
    expect(mdEn).toContain('Station 1 — Syntax & Configuration — [PASS]');

    const cliOpts = parseCliArgs(['--lang', 'en', '--markdown', '.'], '/tmp/demo');
    expect(cliOpts.lang).toBe('en');
    expect(cliOpts.format).toBe('markdown');

    const idleEn = await handleRunItv({ lang: 'en' });
    expect(idleEn.content[0]?.text).toContain('ITV Code Gate cockpit is open');

    const mcpEn = await handleRunItv(
      { repoPath: '/tmp/demo', format: 'markdown', lang: 'en' },
      { execute: async () => report }
    );
    expect(mcpEn.content[0]?.text).toContain('ITV Code Gate Report');
  });
});
