import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { RunItvInspection } from '../src/application/RunItvInspection.js';
import type {
  CommandExecutor,
  CommandResult,
  CommandRunOptions,
  InspectionEvent
} from '../src/domain/types.js';
import { scanSecretsAndIps } from '../src/infrastructure/scanners/SecretAndIpScanner.js';
import { buildSecurityChecklist } from '../src/infrastructure/scanners/SecurityChecklistScanner.js';
import { scanStaticHtmlAccessibility } from '../src/infrastructure/scanners/StaticHtmlA11yScanner.js';
import { createDefaultStations } from '../src/infrastructure/stations/index.js';
import { extractCoveragePercent } from '../src/infrastructure/stations/TestsCoverageStation.js';

const tempDirs: string[] = [];

async function createTempRepo(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'itv-scan-'));
  tempDirs.push(dir);
  return dir;
}

class FakeCommandExecutor implements CommandExecutor {
  constructor(
    private readonly handler: (
      binary: string,
      args: readonly string[],
      options: CommandRunOptions
    ) => Partial<CommandResult>
  ) {}

  async run(
    binary: string,
    args: readonly string[],
    options: CommandRunOptions
  ): Promise<CommandResult> {
    const partial = this.handler(binary, args, options);
    return {
      command: [binary, ...args].join(' '),
      exitCode: partial.exitCode ?? 0,
      stdout: partial.stdout ?? 'OK',
      stderr: partial.stderr ?? '',
      durationMs: partial.durationMs ?? 5,
      timedOut: partial.timedOut ?? false,
      notFound: partial.notFound ?? false
    };
  }
}

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      await rm(dir, { recursive: true, force: true });
    }
  }
});

describe('SecretAndIpScanner', () => {
  it('detecta credenciales hardcodeadas e IPs http:// pero ignora 127.0.0.1 y .env.example', async () => {
    const dir = await createTempRepo();
    const fakeAwsKey = ['AKIA', '1234567890ABCDEF'].join('');
    const fakeInfraUrl = ['http://', '10.20.30.40:8080/api'].join('');
    await writeFile(
      path.join(dir, 'config.ts'),
      [
        `const aws = "${fakeAwsKey}";`,
        `const badUrl = "${fakeInfraUrl}";`,
        'const localUrl = "http://127.0.0.1:4173";'
      ].join('\n')
    );
    await writeFile(path.join(dir, '.env.example'), `API_KEY=${fakeAwsKey}\n`);

    const { findings } = await scanSecretsAndIps(dir);
    expect(findings.some((f) => f.title.includes('AWS'))).toBe(true);
    expect(findings.some((f) => f.title.includes('IP de infraestructura'))).toBe(true);
    expect(findings.some((f) => f.file === '.env.example')).toBe(false);
    expect(findings.length).toBe(2);
  });
});

describe('StaticHtmlA11yScanner', () => {
  it('detecta fallos WCAG básicos en HTML, vistas PHP/TSX, links vacíos y saltos de headings', async () => {
    const badDir = await createTempRepo();
    await writeFile(
      path.join(badDir, 'bad.html'),
      '<html><body><h1>Título</h1><h4>Salto</h4><img src="a.png"><input type="text"><button></button><a href="/x"></a></body></html>'
    );
    await writeFile(
      path.join(badDir, 'view.php'),
      '<?php $x = 1; ?><section><img src="hero.png"></section>'
    );
    const badRes = await scanStaticHtmlAccessibility(badDir);
    expect(badRes.filesScanned).toBe(2);
    expect(badRes.findings.some((f) => f.title.includes('Enlace <a>'))).toBe(true);
    expect(badRes.findings.some((f) => f.title.includes('Salto de jerarquía'))).toBe(true);
    expect(badRes.findings.some((f) => f.file === 'view.php')).toBe(true);

    const goodDir = await createTempRepo();
    await writeFile(
      path.join(goodDir, 'good.html'),
      '<html lang="es"><body><h1>Título</h1><h2>Sub</h2><img src="a.png" alt="Logo"><label for="q">Buscar</label><input id="q" type="text"><button>Enviar</button><a href="/home">Inicio</a></body></html>'
    );
    const goodRes = await scanStaticHtmlAccessibility(goodDir);
    expect(goodRes.findings.length).toBe(0);
  });
});

describe('SecurityChecklistScanner', () => {
  it('evalúa controles automáticos y genera bloque operativo/legal con disclaimer', async () => {
    const dir = await createTempRepo();
    await writeFile(path.join(dir, '.gitignore'), 'node_modules/\n.env\n');
    await writeFile(path.join(dir, 'package-lock.json'), '{}');
    await writeFile(
      path.join(dir, 'server.ts'),
      'res.setHeader("X-Content-Type-Options", "nosniff");'
    );

    const { checklist } = await buildSecurityChecklist({
      repoPath: dir,
      stack: {
        repoPath: dir,
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
      secretFindings: [],
      dependencyAuditStatus: 'pass',
      dependencyAuditDetail: '0 CVEs.'
    });

    expect(checklist.scorePercent).toBe(100);
    expect(checklist.automatedPassed).toBe(checklist.automatedTotal);
    expect(checklist.items.some((i) => i.category === 'operational')).toBe(true);
    expect(checklist.disclaimer).toMatch(/OWASP|RGPD/i);
  });
});

describe('Coverage extraction & RunItvInspection end-to-end', () => {
  it('extrae cobertura de Vitest, Pytest y PHPUnit', () => {
    expect(extractCoveragePercent('All files |   84.25 |   75.00 |')).toBe(84.25);
    expect(extractCoveragePercent('TOTAL    100    10    90%')).toBe(90);
    expect(extractCoveragePercent('Lines:   78.40% (100/128)')).toBe(78.4);
  });

  it('ejecuta las 6 estaciones en orden y bloquea si la cobertura cae por debajo del umbral', async () => {
    const dir = await createTempRepo();
    await writeFile(
      path.join(dir, 'package.json'),
      JSON.stringify({
        scripts: {
          test: 'vitest run',
          'test:coverage': 'vitest run --coverage'
        },
        devDependencies: { typescript: '^5.7.0' }
      })
    );
    await writeFile(path.join(dir, 'tsconfig.json'), '{}');
    await writeFile(path.join(dir, '.gitignore'), '.env\n');
    await writeFile(path.join(dir, 'package-lock.json'), '{}');

    const executor = new FakeCommandExecutor((binary, args) => {
      if (binary === 'npm' && args.includes('test:coverage')) {
        return {
          exitCode: 0,
          stdout: 'All files |   52.00 |   40.00 |'
        };
      }
      return { exitCode: 0, stdout: 'OK' };
    });

    const events: InspectionEvent[] = [];
    const runner = new RunItvInspection(createDefaultStations(), executor);
    const report = await runner.execute(
      {
        repoPath: dir,
        slowMotionMs: 0,
        minCoverage: 75
      },
      (event) => events.push(event)
    );

    expect(report.stations).toHaveLength(6);
    expect(report.stations[2]?.id).toBe('tests-coverage');
    expect(report.stations[2]?.status).toBe('fail');
    expect(report.blocksPush).toBe(true);
    expect(report.verdict).toBe('DESFAVORABLE');
    expect(report.securityChecklist).toBeDefined();
    expect(events[0]?.type).toBe('inspection:start');
    expect(events[events.length - 1]?.type).toBe('inspection:complete');
  });
});
