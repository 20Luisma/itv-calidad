import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { detectRepoStack } from '../src/application/DetectRepoStack.js';
import { exportReportAsMarkdown } from '../src/application/ExportReportMarkdown.js';
import { STATION_CATALOG } from '../src/domain/catalog.js';
import { buildInspectionReport, createStationResult } from '../src/domain/report.js';
import { parseCliArgs } from '../src/interfaces/cli/parseArgs.js';

const tempDirs: string[] = [];

async function createTempRepo(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'itv-test-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      await rm(dir, { recursive: true, force: true });
    }
  }
});

describe('Domain Report & Verdict', () => {
  it('bloquea el push si al menos una estación falla (cero falsos verdes)', () => {
    const s1 = createStationResult({
      metadata: STATION_CATALOG['syntax-config'],
      command: 'tsc',
      status: 'pass',
      durationMs: 20,
      summary: 'OK',
      rawOutput: ''
    });
    const s2 = createStationResult({
      metadata: STATION_CATALOG['security-cves'],
      command: 'npm audit',
      status: 'fail',
      durationMs: 30,
      summary: 'CVE crítica',
      rawOutput: '1 critical'
    });

    const report = buildInspectionReport({
      inspectionId: 'test-1',
      startedAt: new Date('2026-11-23T10:00:00Z'),
      finishedAt: new Date('2026-11-23T10:00:02Z'),
      stack: {
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
      },
      stations: [s1, s2]
    });

    expect(report.verdict).toBe('DESFAVORABLE');
    expect(report.blocksPush).toBe(true);
    expect(report.summary).toEqual({
      total: 2,
      passed: 1,
      warned: 0,
      failed: 1,
      skipped: 0
    });

    const md = exportReportAsMarkdown(report);
    expect(md).toContain('DESFAVORABLE (BLOQUEA PUSH)');
    expect(md).toContain('Estación 4 — Seguridad y Dependencias (CVEs)');
  });

  it('devuelve APTO_CON_OBSERVACIONES cuando solo hay warnings y no errores', () => {
    const s1 = createStationResult({
      metadata: STATION_CATALOG['syntax-config'],
      command: 'node --check',
      status: 'warn',
      durationMs: 10,
      summary: 'Observación',
      rawOutput: ''
    });

    const report = buildInspectionReport({
      inspectionId: 'test-2',
      startedAt: new Date('2026-11-23T10:00:00Z'),
      finishedAt: new Date('2026-11-23T10:00:01Z'),
      stack: {
        repoPath: '/tmp/demo',
        repoName: 'demo',
        primaryStack: 'node',
        detectedStacks: ['node'],
        hasTypeScript: false,
        hasPackageJson: true,
        hasComposerJson: false,
        hasPythonProject: false,
        hasPlaywright: false,
        hasAccessibilityTooling: false,
        packageScripts: {},
        composerScripts: {}
      },
      stations: [s1]
    });

    expect(report.verdict).toBe('APTO_CON_OBSERVACIONES');
    expect(report.blocksPush).toBe(false);
  });
});

describe('DetectRepoStack', () => {
  it('detecta un repo Node + TypeScript + Playwright', async () => {
    const dir = await createTempRepo();
    await writeFile(
      path.join(dir, 'package.json'),
      JSON.stringify({
        scripts: { test: 'vitest run', 'test:e2e': 'playwright test' },
        devDependencies: { typescript: '^5.0.0', '@playwright/test': '^1.48.0' }
      })
    );
    await writeFile(path.join(dir, 'tsconfig.json'), '{}');

    const stack = await detectRepoStack(dir);
    expect(stack.primaryStack).toBe('node');
    expect(stack.hasTypeScript).toBe(true);
    expect(stack.hasPlaywright).toBe(true);
    expect(stack.detectedStacks).toEqual(['node']);
  });

  it('detecta un repo PHP mixto con tooling Node de accesibilidad', async () => {
    const dir = await createTempRepo();
    await writeFile(path.join(dir, 'composer.json'), JSON.stringify({ name: 'acme/app' }));
    await writeFile(
      path.join(dir, 'package.json'),
      JSON.stringify({ devDependencies: { 'pa11y-ci': '^3.0.0' } })
    );

    const stack = await detectRepoStack(dir);
    expect(stack.primaryStack).toBe('php');
    expect(stack.hasComposerJson).toBe(true);
    expect(stack.hasAccessibilityTooling).toBe(true);
  });

  it('detecta proyectos vanilla PHP/JS sin composer.json ni package.json', async () => {
    const dir = await createTempRepo();
    await writeFile(path.join(dir, 'index.php'), '<?php echo "hola";');
    await writeFile(path.join(dir, 'app.js'), 'console.log("ok");');

    const stack = await detectRepoStack(dir);
    expect(stack.primaryStack).toBe('php');
    expect(stack.detectedStacks).toEqual(['php', 'node']);
    expect(stack.hasComposerJson).toBe(false);
  });

  it('lanza error claro si la ruta no existe', async () => {
    await expect(detectRepoStack('/ruta/que/no/existe/jamas')).rejects.toThrow(/no existe/i);
  });
});

describe('CLI parseCliArgs', () => {
  it('parsea flags --fast, --min-coverage, --json y ruta personalizada', () => {
    const opts = parseCliArgs(
      ['/tmp/mi-repo', '--delay', '500', '--min-coverage', '80', '--markdown'],
      '/default'
    );
    expect(opts.repoPath).toBe('/tmp/mi-repo');
    expect(opts.minCoverage).toBe(80);
    expect(opts.format).toBe('markdown');
    expect(opts.slowMotionMs).toBe(0);
  });
});
