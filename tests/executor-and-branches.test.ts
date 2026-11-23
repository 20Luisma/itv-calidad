import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { exportReportAsMarkdown } from '../src/application/ExportReportMarkdown.js';
import { RunItvInspection } from '../src/application/RunItvInspection.js';
import { STATION_CATALOG } from '../src/domain/catalog.js';
import { buildInspectionReport, createStationResult } from '../src/domain/report.js';
import type { CommandExecutor, CommandResult, RepoStack } from '../src/domain/types.js';
import { SafeCommandExecutor, stripAnsi } from '../src/infrastructure/exec/SafeCommandExecutor.js';
import { pickNativeFolder } from '../src/infrastructure/exec/NativeFolderPicker.js';
import { AccessibilityUiStation } from '../src/infrastructure/stations/AccessibilityUiStation.js';
import { E2eBrowserStation } from '../src/infrastructure/stations/E2eBrowserStation.js';
import { SecurityCvesStation } from '../src/infrastructure/stations/SecurityCvesStation.js';
import { StaticTypesStation } from '../src/infrastructure/stations/StaticTypesStation.js';
import { SyntaxConfigStation } from '../src/infrastructure/stations/SyntaxConfigStation.js';
import { TestsCoverageStation } from '../src/infrastructure/stations/TestsCoverageStation.js';
import { createWebServer } from '../src/interfaces/web/httpApp.js';

const tempDirs: string[] = [];
let activeServer: ReturnType<typeof createWebServer> | null = null;

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'itv-extra-'));
  tempDirs.push(dir);
  return dir;
}

class StubExecutor implements CommandExecutor {
  constructor(private readonly fn: (bin: string, args: readonly string[]) => Partial<CommandResult>) {}

  async run(binary: string, args: readonly string[]): Promise<CommandResult> {
    const res = this.fn(binary, args);
    return {
      command: [binary, ...args].join(' '),
      exitCode: res.exitCode ?? 0,
      stdout: res.stdout ?? '',
      stderr: res.stderr ?? '',
      durationMs: res.durationMs ?? 2,
      timedOut: res.timedOut ?? false,
      notFound: res.notFound ?? false
    };
  }
}

afterEach(async () => {
  if (activeServer) {
    await new Promise<void>((resolve) => activeServer?.close(() => resolve()));
    activeServer = null;
  }
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) await rm(dir, { recursive: true, force: true });
  }
});

describe('SafeCommandExecutor', () => {
  it('ejecuta un comando real, detecta ENOENT, respeta timeout y AbortSignal', async () => {
    const exec = new SafeCommandExecutor();

    const ok = await exec.run(process.execPath, ['-e', 'console.log("hola-itv")'], {
      cwd: process.cwd()
    });
    expect(ok.exitCode).toBe(0);
    expect(ok.stdout).toBe('hola-itv');
    expect(ok.notFound).toBe(false);
    expect(stripAnsi('\u001b[1A\u001b[2K\u001b[32mPASS\u001b[0m')).toBe('PASS');

    const missing = await exec.run('binario-inexistente-itv-xyz', [], { cwd: process.cwd() });
    expect(missing.notFound).toBe(true);
    expect(missing.exitCode).toBeNull();

    const ac = new AbortController();
    ac.abort();
    const aborted = await exec.run(process.execPath, ['-v'], {
      cwd: process.cwd(),
      signal: ac.signal
    });
    expect(aborted.exitCode).toBeNull();
    expect(aborted.stderr).toContain('cancelada');

    const slow = await exec.run(process.execPath, ['-e', 'setTimeout(() => {}, 5000)'], {
      cwd: process.cwd(),
      timeoutMs: 80
    });
    expect(slow.timedOut).toBe(true);
  });
});

describe('Stations edge cases (PHP, Python, Playwright, A11y, Security)', () => {
  it('SyntaxConfigStation cubre PHP, Python y package.json roto', async () => {
    const dir = await createTempDir();
    await writeFile(path.join(dir, 'package.json'), '{ roto');
    await writeFile(path.join(dir, 'index.php'), '<?php echo "ok";');
    await writeFile(path.join(dir, 'app.py'), 'print("ok")\n');

    const stack: RepoStack = {
      repoPath: dir,
      repoName: 'mix',
      primaryStack: 'php',
      detectedStacks: ['php', 'node', 'python'],
      hasTypeScript: false,
      hasPackageJson: true,
      hasComposerJson: true,
      hasPythonProject: true,
      hasPlaywright: false,
      hasAccessibilityTooling: false,
      packageScripts: { lint: 'eslint .' },
      composerScripts: {}
    };

    const exec = new StubExecutor((bin) => {
      if (bin === 'composer') return { exitCode: 1, stderr: 'invalid composer.json' };
      if (bin === 'php') return { exitCode: 1, stderr: 'Parse error' };
      if (bin === 'npm') return { exitCode: 1, stdout: 'lint error' };
      if (bin === 'python3') return { exitCode: 1, stderr: 'SyntaxError' };
      return { exitCode: 0 };
    });

    const res = await new SyntaxConfigStation().run({
      repoPath: dir,
      stack,
      minCoverage: 75,
      commandTimeoutMs: 5000,
      executor: exec
    });

    expect(res.status).toBe('fail');
    expect(res.findings.length).toBeGreaterThanOrEqual(4);
  });

  it('StaticTypesStation cubre errores de TS, PHPStan y Python mypy/ruff', async () => {
    const dir = await createTempDir();
    await mkdir(path.join(dir, 'vendor', 'bin'), { recursive: true });
    await writeFile(path.join(dir, 'vendor', 'bin', 'phpstan'), '');

    const stack: RepoStack = {
      repoPath: dir,
      repoName: 'typed',
      primaryStack: 'node',
      detectedStacks: ['node', 'php', 'python'],
      hasTypeScript: true,
      hasPackageJson: true,
      hasComposerJson: true,
      hasPythonProject: true,
      hasPlaywright: false,
      hasAccessibilityTooling: false,
      packageScripts: {},
      composerScripts: {}
    };

    const exec = new StubExecutor((bin) => {
      if (bin.includes('tsc') || bin === 'npx') {
        return {
          exitCode: 2,
          stdout: 'src/a.ts(10,5): error TS2322: Type string is not assignable to number'
        };
      }
      if (bin.includes('phpstan')) return { exitCode: 1, stdout: '1 error' };
      if (bin === 'mypy') return { notFound: true, exitCode: null };
      if (bin === 'ruff') return { exitCode: 1, stdout: 'F401 unused' };
      return { exitCode: 0 };
    });

    const res = await new StaticTypesStation().run({
      repoPath: dir,
      stack,
      minCoverage: 75,
      commandTimeoutMs: 5000,
      executor: exec
    });

    expect(res.status).toBe('fail');
    expect(res.findings.some((f) => f.title.includes('TS2322'))).toBe(true);
    expect(res.findings.some((f) => f.title.includes('PHPStan'))).toBe(true);
    expect(res.findings.some((f) => f.title.includes('ruff'))).toBe(true);
  });

  it('TestsCoverageStation cubre sin suite, binario faltante y fallo de suite', async () => {
    const dir = await createTempDir();
    const emptyStack: RepoStack = {
      repoPath: dir,
      repoName: 'empty',
      primaryStack: 'unknown',
      detectedStacks: ['unknown'],
      hasTypeScript: false,
      hasPackageJson: false,
      hasComposerJson: false,
      hasPythonProject: false,
      hasPlaywright: false,
      hasAccessibilityTooling: false,
      packageScripts: {},
      composerScripts: {}
    };

    const noSuite = await new TestsCoverageStation().run({
      repoPath: dir,
      stack: emptyStack,
      minCoverage: 75,
      commandTimeoutMs: 5000,
      executor: new StubExecutor(() => ({ exitCode: 0 }))
    });
    expect(noSuite.status).toBe('warn');

    const pyStack: RepoStack = { ...emptyStack, primaryStack: 'python', hasPythonProject: true };
    const missingBin = await new TestsCoverageStation().run({
      repoPath: dir,
      stack: pyStack,
      minCoverage: 75,
      commandTimeoutMs: 5000,
      executor: new StubExecutor(() => ({ notFound: true, exitCode: null, stderr: 'not found' }))
    });
    expect(missingBin.status).toBe('warn');

    const failedTests = await new TestsCoverageStation().run({
      repoPath: dir,
      stack: pyStack,
      minCoverage: 75,
      commandTimeoutMs: 5000,
      executor: new StubExecutor(() => ({ exitCode: 1, stdout: '1 failed' }))
    });
    expect(failedTests.status).toBe('fail');
  });

  it('SecurityCvesStation detecta CVEs en npm, composer y pip-audit', async () => {
    const dir = await createTempDir();
    await writeFile(path.join(dir, 'danger.js'), 'eval("1+1"); const opts = { shell: true };\n');

    const stack: RepoStack = {
      repoPath: dir,
      repoName: 'sec',
      primaryStack: 'node',
      detectedStacks: ['node', 'php', 'python'],
      hasTypeScript: false,
      hasPackageJson: true,
      hasComposerJson: true,
      hasPythonProject: true,
      hasPlaywright: false,
      hasAccessibilityTooling: false,
      packageScripts: {},
      composerScripts: {}
    };

    const res = await new SecurityCvesStation().run({
      repoPath: dir,
      stack,
      minCoverage: 75,
      commandTimeoutMs: 5000,
      executor: new StubExecutor(() => ({ exitCode: 1, stdout: '1 critical vulnerability' }))
    });

    expect(res.status).toBe('fail');
    expect(res.securityChecklist).toBeDefined();
    expect(res.findings.some((f) => f.title.includes('npm audit'))).toBe(true);
    expect(res.findings.some((f) => f.title.includes('composer audit'))).toBe(true);
    expect(res.findings.some((f) => f.title.includes('pip-audit'))).toBe(true);
    expect(res.findings.some((f) => f.title.includes('eval()'))).toBe(true);
  });

  it('E2eBrowserStation y AccessibilityUiStation cubren pass y fail con scripts configurados', async () => {
    const dir = await createTempDir();
    await writeFile(path.join(dir, 'index.html'), '<html lang="es"><body><button>OK</button></body></html>');

    const stack: RepoStack = {
      repoPath: dir,
      repoName: 'web',
      primaryStack: 'node',
      detectedStacks: ['node'],
      hasTypeScript: false,
      hasPackageJson: true,
      hasComposerJson: false,
      hasPythonProject: false,
      hasPlaywright: true,
      hasAccessibilityTooling: true,
      packageScripts: { 'test:e2e': 'playwright test', 'test:a11y': 'pa11y-ci' },
      composerScripts: {}
    };

    const passE2e = await new E2eBrowserStation().run({
      repoPath: dir,
      stack,
      minCoverage: 75,
      commandTimeoutMs: 5000,
      executor: new StubExecutor(() => ({ exitCode: 0, stdout: '5 passed' }))
    });
    expect(passE2e.status).toBe('pass');

    const failE2e = await new E2eBrowserStation().run({
      repoPath: dir,
      stack,
      minCoverage: 75,
      commandTimeoutMs: 5000,
      executor: new StubExecutor(() => ({ exitCode: 1, stderr: 'Timeout waiting selector' }))
    });
    expect(failE2e.status).toBe('fail');

    const failA11y = await new AccessibilityUiStation().run({
      repoPath: dir,
      stack,
      minCoverage: 75,
      commandTimeoutMs: 5000,
      targetUrl: 'http://127.0.0.1:4173',
      executor: new StubExecutor(() => ({ exitCode: 1, stdout: 'WCAG contrast error' }))
    });
    expect(failA11y.status).toBe('fail');
    expect(failA11y.findings.some((f) => f.title.includes('WCAG 2.1 AA detectadas en vivo'))).toBe(true);

    const missingPa11y = await new AccessibilityUiStation().run({
      repoPath: dir,
      stack: { ...stack, hasAccessibilityTooling: false },
      minCoverage: 75,
      commandTimeoutMs: 5000,
      targetUrl: 'http://127.0.0.1:4173',
      executor: new StubExecutor(() => ({ notFound: true, exitCode: null }))
    });
    expect(missingPa11y.status).toBe('warn');

    const chromeMissing = await new AccessibilityUiStation().run({
      repoPath: dir,
      stack: { ...stack, hasAccessibilityTooling: false },
      minCoverage: 75,
      commandTimeoutMs: 5000,
      targetUrl: 'http://127.0.0.1:4173',
      executor: new StubExecutor(() => ({
        exitCode: 1,
        stderr: 'Error: Could not find Chrome (ver. 142) at ChromeLauncher.launch'
      }))
    });
    expect(chromeMissing.status).toBe('warn');
    expect(chromeMissing.findings.some((f) => f.title.includes('Entorno de navegador'))).toBe(true);
  });
});

describe('Export Markdown & HTTP endpoints extra', () => {
  it('exporta Markdown con hallazgos y checklist, y el server responde POST /api/export/markdown', async () => {
    const stationWithChecklist = createStationResult({
      metadata: STATION_CATALOG['security-cves'],
      command: 'npm audit',
      status: 'warn',
      durationMs: 12,
      summary: 'Observación',
      rawOutput: 'ok',
      findings: [
        {
          severity: 'warning',
          title: 'IP hardcodeada',
          file: 'src/api.ts',
          line: 4,
          reason: 'HTTP plano',
          howToFix: 'Usar .env'
        }
      ],
      securityChecklist: {
        generatedAt: '2026-11-23T10:00:00Z',
        disclaimer: 'Guía OWASP/RGPD',
        automatedPassed: 5,
        automatedTotal: 6,
        scorePercent: 83,
        items: [
          {
            id: 'env',
            category: 'automated',
            title: '.env protegido',
            standardRef: 'OWASP',
            status: 'pass',
            detail: 'OK',
            recommendation: 'Mantener'
          }
        ]
      }
    });

    const report = buildInspectionReport({
      inspectionId: 'md-1',
      startedAt: new Date('2026-11-23T10:00:00Z'),
      finishedAt: new Date('2026-11-23T10:00:01Z'),
      stack: {
        repoPath: '/tmp/app',
        repoName: 'app',
        primaryStack: 'node',
        detectedStacks: ['node'],
        hasTypeScript: true,
        hasPackageJson: true,
        hasComposerJson: false,
        hasPythonProject: false,
        hasPlaywright: false,
        hasAccessibilityTooling: false,
        packageScripts: {},
        composerScripts: {},
        gitBranch: 'main'
      },
      stations: [stationWithChecklist]
    });

    const md = exportReportAsMarkdown(report);
    expect(md).toContain('Checklist de Tranquilidad');
    expect(md).toContain('IP hardcodeada');

    activeServer = createWebServer({
      executor: new StubExecutor(() => ({ exitCode: 0 }))
    });
    await new Promise<void>((resolve) => activeServer?.listen(0, '127.0.0.1', () => resolve()));
    const addr = activeServer.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${addr.port}`;

    const mdRes = await fetch(`${baseUrl}/api/export/markdown`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report)
    });
    expect(mdRes.status).toBe(200);
    expect(await mdRes.text()).toContain('# Informe ITV de Código — app');

    const badJson = await fetch(`${baseUrl}/api/export/markdown`, {
      method: 'POST',
      body: '{invalid'
    });
    expect(badJson.status).toBe(400);

    const methodNotAllowed = await fetch(`${baseUrl}/api/health`, { method: 'DELETE' });
    expect(methodNotAllowed.status).toBe(405);

    const indexRes = await fetch(`${baseUrl}/`);
    expect(indexRes.status).toBe(200);
    expect(await indexRes.text()).toContain('ITV de Código');
  });

  it('RunItvInspection soporta pausa cámara lenta y error en ruta inválida', async () => {
    const runner = new RunItvInspection([], new StubExecutor(() => ({ exitCode: 0 })));
    await expect(runner.execute({ repoPath: '/no/existe/itv' })).rejects.toThrow(/no existe/i);

    const dir = await createTempDir();
    const ok = await runner.execute({ repoPath: dir, slowMotionMs: 10 });
    expect(ok.verdict).toBe('APTO');
  });

  it('pickNativeFolder soporta macOS, Windows (PowerShell) y Linux (zenity)', async () => {
    const macExec = new StubExecutor((bin) =>
      bin === 'osascript' ? { exitCode: 0, stdout: '/Users/demo/app/\n' } : { exitCode: 1 }
    );
    expect(await pickNativeFolder(macExec, 'darwin')).toBe('/Users/demo/app');

    const winExec = new StubExecutor((bin) =>
      bin === 'powershell' ? { exitCode: 0, stdout: 'C:\\Proyectos\\mi-app\\\r\n' } : { exitCode: 1 }
    );
    expect(await pickNativeFolder(winExec, 'win32')).toBe('C:\\Proyectos\\mi-app');

    const linuxExec = new StubExecutor((bin) =>
      bin === 'zenity' ? { exitCode: 0, stdout: '/home/dev/repo/\n' } : { notFound: true, exitCode: null }
    );
    expect(await pickNativeFolder(linuxExec, 'linux')).toBe('/home/dev/repo');
  });
});
