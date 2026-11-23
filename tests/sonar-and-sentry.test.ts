import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { CommandExecutor, CommandResult, RepoStack } from '../src/domain/types.js';
import { loadLocalEnv } from '../src/infrastructure/config/loadDotEnv.js';
import { querySentryIssues } from '../src/infrastructure/integrations/SentryApiClient.js';
import { querySonarCloud } from '../src/infrastructure/integrations/SonarCloudClient.js';
import {
  estimateCyclomaticComplexity,
  scanCodeHealthSonar
} from '../src/infrastructure/scanners/CodeHealthSonarScanner.js';
import { scanObservabilitySentry } from '../src/infrastructure/scanners/ObservabilitySentryScanner.js';
import { CodeHealthObservabilityStation } from '../src/infrastructure/stations/CodeHealthObservabilityStation.js';

const tempDirs: string[] = [];

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'itv-sonar-'));
  tempDirs.push(dir);
  return dir;
}

class NoopExecutor implements CommandExecutor {
  async run(binary: string, args: readonly string[]): Promise<CommandResult> {
    return {
      command: [binary, ...args].join(' '),
      exitCode: 0,
      stdout: '',
      stderr: '',
      durationMs: 1,
      timedOut: false,
      notFound: false
    };
  }
}

function buildStack(repoPath: string): RepoStack {
  return {
    repoPath,
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
}

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) await rm(dir, { recursive: true, force: true });
  }
});

describe('CodeHealthSonarScanner', () => {
  it('detecta archivos monolíticos, debugger, var_dump y bloques duplicados entre archivos', async () => {
    const dir = await createTempDir();
    await writeFile(path.join(dir, 'sonar-project.properties'), 'sonar.projectKey=demo\n');

    const duplicatedBlock = [
      'export function calculateOrderTotals(items: number[], taxRate: number): number {',
      '  const subtotal = items.reduce((acc, current) => acc + current, 0);',
      '  const discount = subtotal > 500 ? subtotal * 0.1 : 0;',
      '  const taxableAmount = Math.max(0, subtotal - discount);',
      '  const taxAmount = taxableAmount * taxRate;',
      '  const shippingFee = taxableAmount > 200 ? 0 : 15;',
      '  const finalTotal = taxableAmount + taxAmount + shippingFee;',
      '  return Math.round(finalTotal * 100) / 100;',
      '}'
    ].join('\n');

    await writeFile(path.join(dir, 'ordersA.ts'), `${duplicatedBlock}\ndebugger;\n`);
    await writeFile(path.join(dir, 'ordersB.ts'), duplicatedBlock);
    await writeFile(path.join(dir, 'debug.php'), '<?php var_dump($user);');

    const longLines = Array.from({ length: 520 }, (_, i) => `const v${i} = ${i};`).join('\n');
    await writeFile(path.join(dir, 'huge.ts'), longLines);

    const res = await scanCodeHealthSonar(dir);
    expect(res.hasSonarConfig).toBe(true);
    expect(res.duplicateBlocks).toBeGreaterThanOrEqual(1);
    expect(res.findings.some((f) => f.title.includes('debugger') && f.severity === 'error')).toBe(true);
    expect(res.findings.some((f) => f.title.includes('var_dump'))).toBe(true);
    expect(res.findings.some((f) => f.title.includes('duplicado'))).toBe(true);
    expect(res.findings.some((f) => f.title.includes('demasiado extenso'))).toBe(true);
    expect(estimateCyclomaticComplexity('if (a && b) { for (;;) {} } else if (c) {}')).toBeGreaterThan(4);
  });
});

describe('ObservabilitySentryScanner & Station 7', () => {
  it('bloquea Sentry DSN hardcodeado y advierte sendDefaultPii: true', async () => {
    const dir = await createTempDir();
    const fakeDsn = ['https://', 'abcdef1234567890abcdef12', '@o12345.ingest.sentry.io/999999'].join('');
    await writeFile(
      path.join(dir, 'sentry.ts'),
      `Sentry.init({ dsn: "${fakeDsn}", sendDefaultPii: true });\n`
    );

    const res = await scanObservabilitySentry(dir, buildStack(dir));
    expect(res.sentryDetected).toBe(true);
    expect(res.findings.some((f) => f.title.includes('DSN hardcodeado') && f.severity === 'error')).toBe(true);
    expect(res.findings.some((f) => f.title.includes('sendDefaultPii') && f.severity === 'warning')).toBe(true);

    const stationRes = await new CodeHealthObservabilityStation().run({
      repoPath: dir,
      stack: buildStack(dir),
      minCoverage: 75,
      commandTimeoutMs: 5000,
      executor: new NoopExecutor()
    });
    expect(stationRes.status).toBe('fail');
  });

  it('pasa en verde (pass) cuando el código está limpio y lee SENTRY_DSN desde env', async () => {
    const dir = await createTempDir();
    await writeFile(
      path.join(dir, 'app.ts'),
      'if (process.env.SENTRY_DSN) { Sentry.init({ dsn: process.env.SENTRY_DSN, sendDefaultPii: false }); }\n'
    );

    const stationRes = await new CodeHealthObservabilityStation().run({
      repoPath: dir,
      stack: buildStack(dir),
      minCoverage: 75,
      commandTimeoutMs: 5000,
      executor: new NoopExecutor()
    });
    expect(stationRes.status).toBe('pass');
    expect(stationRes.metrics?.observability).toBe('Sentry');
  });
});

describe('Live API clients (SonarCloud, Sentry) & loadLocalEnv', () => {
  it('SonarCloudClient devuelve enlace directo sin token y Quality Gate real con token', async () => {
    const dir = await createTempDir();
    await writeFile(
      path.join(dir, 'sonar-project.properties'),
      'sonar.projectKey=20Luisma_marvel\nsonar.host.url=https://sonarcloud.io\n'
    );

    const withoutToken = await querySonarCloud(dir, { env: {} });
    expect(withoutToken.link?.status).toBe('not-configured');
    expect(withoutToken.link?.url).toBe('https://sonarcloud.io/dashboard?id=20Luisma_marvel');

    const fakeFetch = (async (url: string | URL) => {
      const target = String(url);
      if (target.includes('qualitygates')) {
        return new Response(JSON.stringify({ projectStatus: { status: 'ERROR' } }), { status: 200 });
      }
      return new Response(
        JSON.stringify({
          component: {
            measures: [
              { metric: 'bugs', value: '2' },
              { metric: 'code_smells', value: '5' }
            ]
          }
        }),
        { status: 200 }
      );
    }) as typeof fetch;

    const withToken = await querySonarCloud(dir, {
      env: { SONAR_TOKEN: 'fake-token-test' },
      fetchImpl: fakeFetch
    });
    expect(withToken.link?.status).toBe('connected');
    expect(withToken.link?.summary).toContain('Quality Gate: ERROR');
    expect(withToken.findings.some((f) => f.severity === 'error')).toBe(true);
  });

  it('SentryApiClient devuelve enlace sin token, issues reales con token y maneja HTTP 401', async () => {
    const noToken = await querySentryIssues({
      env: { SENTRY_ORG: 'mi-org', SENTRY_PROJECT: 'mi-app' }
    });
    expect(noToken.link?.status).toBe('not-configured');
    expect(noToken.link?.url).toContain('/organizations/mi-org/issues/');

    const okFetch = (async () =>
      new Response(
        JSON.stringify([
          { shortId: 'APP-1', title: 'TypeError: Cannot read id', count: '12' }
        ]),
        { status: 200 }
      )) as typeof fetch;

    const connected = await querySentryIssues({
      env: { SENTRY_ORG: 'mi-org', SENTRY_PROJECT: 'mi-app', SENTRY_AUTH_TOKEN: 'tok' },
      fetchImpl: okFetch
    });
    expect(connected.link?.status).toBe('connected');
    expect(connected.findings.some((f) => f.title.includes('1 issue(s)'))).toBe(true);

    const errFetch = (async () => new Response('Unauthorized', { status: 401 })) as typeof fetch;
    const failed = await querySentryIssues({
      env: { SENTRY_ORG: 'mi-org', SENTRY_PROJECT: 'mi-app', SENTRY_AUTH_TOKEN: 'bad' },
      fetchImpl: errFetch
    });
    expect(failed.link?.status).toBe('error');
  });

  it('loadLocalEnv carga variables desde .env sin pisar variables existentes', async () => {
    const dir = await createTempDir();
    await writeFile(path.join(dir, '.env'), 'ITV_TEST_VAR="valor123"\n# comentario\n');
    delete process.env.ITV_TEST_VAR;
    loadLocalEnv(dir);
    expect(process.env.ITV_TEST_VAR).toBe('valor123');
    delete process.env.ITV_TEST_VAR;
  });
});
