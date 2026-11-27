import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { detectRepoStack } from '../src/application/DetectRepoStack.js';
import { initPrePushHook } from '../src/application/InitPrePushHook.js';
import type { CommandExecutor, CommandResult, StationContext } from '../src/domain/types.js';
import { SecurityCvesStation } from '../src/infrastructure/stations/SecurityCvesStation.js';
import { StaticTypesStation } from '../src/infrastructure/stations/StaticTypesStation.js';
import { SyntaxConfigStation } from '../src/infrastructure/stations/SyntaxConfigStation.js';
import { extractCoveragePercent, TestsCoverageStation } from '../src/infrastructure/stations/TestsCoverageStation.js';
import { parseCliArgs } from '../src/interfaces/cli/parseArgs.js';

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

describe('Soporte nativo .NET / C# y --init-hook (v1.5.0)', () => {
  it('detecta un repositorio .NET con .csproj y valida estaciones 1 a 4 en verde', async () => {
    const dir = await makeTempDir('itv-dotnet-ok-');
    await writeFile(
      path.join(dir, 'App.csproj'),
      '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup></Project>',
      'utf8'
    );

    const stack = await detectRepoStack(dir);
    expect(stack.primaryStack).toBe('dotnet');
    expect(stack.hasDotnetProject).toBe(true);
    expect(stack.detectedStacks).toContain('dotnet');

    const executor = makeFakeExecutor((bin, args) => {
      if (bin === 'dotnet' && args[0] === 'test') {
        return { exitCode: 0, stdout: 'Passed!\n| Total | 88.5% |' };
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
    expect(s3.metrics?.coverage).toBe('88.5%');
    expect(s4.status).not.toBe('fail');
    expect(extractCoveragePercent('| Total | 84.2% |')).toBe(84.2);
  });

  it('bloquea push cuando dotnet list package --vulnerable detecta paquetes NuGet vulnerables', async () => {
    const dir = await makeTempDir('itv-dotnet-cve-');
    await writeFile(path.join(dir, 'Broken.csproj'), '<Project Sdk="Microsoft.NET.Sdk">', 'utf8');

    const stack = await detectRepoStack(dir);
    const executor = makeFakeExecutor((bin, args) => {
      if (bin === 'dotnet' && args[0] === 'list') {
        return {
          exitCode: 0,
          stdout: 'Project `Broken` has the following vulnerable packages\n > Newtonsoft.Json 9.0.1 High'
        };
      }
      return { exitCode: 1, stderr: 'error CS1002: ; expected' };
    });

    const ctx: StationContext = { repoPath: dir, stack, executor, minCoverage: 75, commandTimeoutMs: 5000 };
    const s1 = await new SyntaxConfigStation().run(ctx);
    const s2 = await new StaticTypesStation().run(ctx);
    const s4 = await new SecurityCvesStation().run(ctx);

    expect(s1.status).toBe('fail');
    expect(s2.status).toBe('fail');
    expect(s4.status).toBe('fail');
    expect(s4.findings.some((f) => f.title.includes('NuGet'))).toBe(true);
  });

  it('crea .githooks/pre-push con initPrePushHook, protege contra sobrescritura y parsea flags CLI', async () => {
    const dir = await makeTempDir('itv-hook-');
    await mkdir(path.join(dir, '.git'));
    const executor = makeFakeExecutor(() => ({ exitCode: 0 }));

    const first = await initPrePushHook(dir, executor, false);
    expect(first.created).toBe(true);
    expect(first.gitHooksConfigured).toBe(true);
    const hookContent = await readFile(first.hookPath, 'utf8');
    expect(hookContent).toContain('npx -y itv-calidad');

    const second = await initPrePushHook(dir, executor, false);
    expect(second.created).toBe(false);
    expect(second.alreadyExisted).toBe(true);

    const forced = await initPrePushHook(dir, executor, true);
    expect(forced.created).toBe(true);

    const cliOpts = parseCliArgs(['--mcp', '--init-hook', '--force', '.'], dir);
    expect(cliOpts.startMcp).toBe(true);
    expect(cliOpts.initHook).toBe(true);
    expect(cliOpts.force).toBe(true);
  });
});
