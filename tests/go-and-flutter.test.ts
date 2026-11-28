import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { detectRepoStack } from '../src/application/DetectRepoStack.js';
import type { CommandExecutor, CommandResult, StationContext } from '../src/domain/types.js';
import { SecurityCvesStation } from '../src/infrastructure/stations/SecurityCvesStation.js';
import { StaticTypesStation } from '../src/infrastructure/stations/StaticTypesStation.js';
import { SyntaxConfigStation } from '../src/infrastructure/stations/SyntaxConfigStation.js';
import { extractCoveragePercent, TestsCoverageStation } from '../src/infrastructure/stations/TestsCoverageStation.js';

const tempDirs: string[] = [];

async function makeTempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function makeFakeExecutor(responder: (bin: string, args: readonly string[]) => Partial<CommandResult>): CommandExecutor {
  return {
    async run(binary: string, args: readonly string[]): Promise<CommandResult> {
      const partial = responder(binary, args);
      return {
        command: `${binary} ${args.join(' ')}`.trim(),
        exitCode: partial.exitCode ?? 0,
        stdout: partial.stdout ?? '',
        stderr: partial.stderr ?? '',
        durationMs: 5,
        timedOut: false,
        notFound: partial.notFound ?? false
      };
    }
  };
}

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) await rm(dir, { recursive: true, force: true });
  }
});

describe('Soporte nativo Flutter/Dart y Go (#3)', () => {
  it('detecta un proyecto Flutter con pubspec.yaml y pasa estaciones 1 a 3 en verde', async () => {
    const dir = await makeTempDir('itv-flutter-ok-');
    await writeFile(
      path.join(dir, 'pubspec.yaml'),
      'name: gastos_naia\ndependencies:\n  flutter:\n    sdk: flutter\n',
      'utf8'
    );

    const stack = await detectRepoStack(dir);
    expect(stack.primaryStack).toBe('flutter');
    expect(stack.hasFlutterProject).toBe(true);

    const calls: string[] = [];
    const executor = makeFakeExecutor((bin, args) => {
      calls.push(`${bin} ${args.join(' ')}`);
      return { exitCode: 0, stdout: 'All tests passed!' };
    });

    const ctx: StationContext = { repoPath: dir, stack, executor, minCoverage: 75, commandTimeoutMs: 5000 };
    const s1 = await new SyntaxConfigStation().run(ctx);
    const s2 = await new StaticTypesStation().run(ctx);
    const s3 = await new TestsCoverageStation().run(ctx);

    expect(s1.status).toBe('pass');
    expect(s2.status).toBe('pass');
    expect(s3.status).toBe('pass');
    expect(calls).toContain('dart analyze');
    expect(calls).toContain('flutter test');
  });

  it('detecta un proyecto Go con go.mod, extrae cobertura y bloquea CVEs con govulncheck', async () => {
    const dir = await makeTempDir('itv-go-');
    await writeFile(path.join(dir, 'go.mod'), 'module github.com/20Luisma/demo\n\ngo 1.22\n', 'utf8');

    const stack = await detectRepoStack(dir);
    expect(stack.primaryStack).toBe('go');
    expect(stack.hasGoProject).toBe(true);

    const executor = makeFakeExecutor((bin, args) => {
      if (bin === 'go' && args[0] === 'test') {
        return { exitCode: 0, stdout: 'ok github.com/20Luisma/demo 0.1s coverage: 86.4% of statements' };
      }
      if (bin === 'govulncheck') {
        return { exitCode: 3, stdout: 'Vulnerability #1: GO-2026-0001' };
      }
      return { exitCode: 0, stdout: 'OK' };
    });

    const ctx: StationContext = { repoPath: dir, stack, executor, minCoverage: 75, commandTimeoutMs: 5000 };
    const s1 = await new SyntaxConfigStation().run(ctx);
    const s2 = await new StaticTypesStation().run(ctx);
    const s3 = await new TestsCoverageStation().run(ctx);
    const s4 = await new SecurityCvesStation().run(ctx);

    expect(s1.status).toBe('pass');
    expect(s2.status).toBe('pass');
    expect(s3.status).toBe('pass');
    expect(s3.metrics?.coverage).toBe('86.4%');
    expect(s4.status).toBe('fail');
    expect(extractCoveragePercent('coverage: 91.2% of statements')).toBe(91.2);
  });
});
