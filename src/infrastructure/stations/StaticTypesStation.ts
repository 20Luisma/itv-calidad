import { access } from 'node:fs/promises';
import path from 'node:path';
import { STATION_CATALOG } from '../../domain/catalog.js';
import { createStationResult } from '../../domain/report.js';
import type { Finding, StationContext, StationResult, StationRunner } from '../../domain/types.js';

async function exists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

export class StaticTypesStation implements StationRunner {
  readonly metadata = STATION_CATALOG['static-types'];

  async run(context: StationContext): Promise<StationResult> {
    const startedAt = Date.now();
    const { stack, repoPath, executor, commandTimeoutMs, signal } = context;
    const findings: Finding[] = [];
    const outputs: string[] = [];
    const commands: string[] = [];
    let hardFailed = false;

    // 1. TypeScript (tsc --noEmit)
    if (stack.hasTypeScript) {
      const localTsc = path.join(repoPath, 'node_modules', '.bin', 'tsc');
      const hasLocalTsc = await exists(localTsc);
      const bin = hasLocalTsc ? localTsc : 'npx';
      const args = hasLocalTsc ? ['--noEmit'] : ['--no-install', 'tsc', '--noEmit'];

      const res = await executor.run(bin, args, {
        cwd: repoPath,
        timeoutMs: commandTimeoutMs,
        ...(signal ? { signal } : {})
      });
      commands.push(hasLocalTsc ? 'tsc --noEmit' : res.command);
      outputs.push(res.stdout || res.stderr || 'tsc --noEmit OK (0 errores)');

      if (res.notFound) {
        findings.push({
          severity: 'warning',
          title: 'TypeScript no instalado en node_modules',
          reason: 'El proyecto tiene `tsconfig.json`, pero `tsc` no está disponible localmente.',
          howToFix: 'Ejecutá `npm install` en el repositorio objetivo.'
        });
      } else if (res.exitCode !== 0) {
        hardFailed = true;
        const lines = (res.stdout || res.stderr)
          .split(/\r?\n/)
          .filter((l) => l.includes('error TS'))
          .slice(0, 8);

        if (lines.length === 0) {
          findings.push({
            severity: 'error',
            title: 'Errores de tipos detectados por TypeScript',
            reason: (res.stdout || res.stderr).slice(0, 400),
            howToFix: 'Corregí los errores reportados por `npx tsc --noEmit` sin usar `any` ni `@ts-ignore`.'
          });
        } else {
          for (const line of lines) {
            const match = /^(.+?)\((\d+),\d+\):\s+error\s+(TS\d+):\s+(.+)$/.exec(line);
            findings.push({
              severity: 'error',
              title: match ? `TypeScript ${match[3]}` : 'Error de tipo TypeScript',
              ...(match?.[1] ? { file: match[1] } : {}),
              ...(match?.[2] ? { line: Number(match[2]) } : {}),
              reason: match?.[4] ?? line,
              howToFix: 'Alineá los tipos o validá valores `undefined`/`null` antes de acceder a propiedades.'
            });
          }
        }
      }
    }

    // 2. PHP (PHPStan)
    if (stack.hasComposerJson) {
      const localPhpstan = path.join(repoPath, 'vendor', 'bin', 'phpstan');
      if (await exists(localPhpstan)) {
        const res = await executor.run(localPhpstan, ['analyse', '--no-progress'], {
          cwd: repoPath,
          timeoutMs: commandTimeoutMs,
          ...(signal ? { signal } : {})
        });
        commands.push('vendor/bin/phpstan analyse --no-progress');
        outputs.push(res.stdout || res.stderr || 'PHPStan OK');
        if (res.exitCode !== 0) {
          hardFailed = true;
          findings.push({
            severity: 'error',
            title: 'PHPStan detectó errores de análisis estático',
            reason: (res.stdout || res.stderr).slice(0, 500),
            howToFix: 'Ejecutá `vendor/bin/phpstan analyse` y resolvé los tipos sin agregar `ignoreErrors` tramposos.'
          });
        }
      } else if (stack.primaryStack === 'php') {
        findings.push({
          severity: 'warning',
          title: 'PHPStan no está instalado en el repositorio PHP',
          reason: 'No se encontró `vendor/bin/phpstan`.',
          howToFix: 'Instalá PHPStan con `composer require --dev phpstan/phpstan` y configurá `phpstan.neon`.'
        });
      }
    }

    // 3. Python (mypy o ruff)
    if (stack.hasPythonProject) {
      const mypyRes = await executor.run('mypy', ['.'], {
        cwd: repoPath,
        timeoutMs: commandTimeoutMs,
        ...(signal ? { signal } : {})
      });
      if (!mypyRes.notFound) {
        commands.push('mypy .');
        outputs.push(mypyRes.stdout || mypyRes.stderr || 'mypy OK');
        if (mypyRes.exitCode !== 0) {
          hardFailed = true;
          findings.push({
            severity: 'error',
            title: 'mypy detectó errores de tipos en Python',
            reason: (mypyRes.stdout || mypyRes.stderr).slice(0, 500),
            howToFix: 'Corregí las anotaciones de tipos reportadas por `mypy .`.'
          });
        }
      } else {
        const ruffRes = await executor.run('ruff', ['check', '.'], {
          cwd: repoPath,
          timeoutMs: commandTimeoutMs,
          ...(signal ? { signal } : {})
        });
        if (!ruffRes.notFound) {
          commands.push('ruff check .');
          outputs.push(ruffRes.stdout || ruffRes.stderr || 'ruff OK');
          if (ruffRes.exitCode !== 0) {
            hardFailed = true;
            findings.push({
              severity: 'error',
              title: 'ruff detectó errores estáticos en Python',
              reason: (ruffRes.stdout || ruffRes.stderr).slice(0, 500),
              howToFix: 'Ejecutá `ruff check .` y resolvé las incidencias.'
            });
          }
        } else {
          findings.push({
            severity: 'warning',
            title: 'No se encontró mypy ni ruff para Python',
            reason: 'Ningún analizador estático de Python está disponible en PATH.',
            howToFix: 'Instalá `mypy` o `ruff` (`pip install mypy ruff`) para habilitar esta estación.'
          });
        }
      }
    }

    // 4. .NET / C# (compilador Roslyn: dotnet build --no-restore)
    if (stack.hasDotnetProject) {
      const dotnetRes = await executor.run('dotnet', ['build', '--no-restore', '--nologo', '-v', 'minimal'], {
        cwd: repoPath,
        timeoutMs: commandTimeoutMs,
        ...(signal ? { signal } : {})
      });
      if (dotnetRes.notFound) {
        findings.push({
          severity: 'warning',
          title: 'SDK de .NET (dotnet) no encontrado en PATH',
          reason: 'El repositorio es .NET pero el binario `dotnet` no está instalado localmente.',
          howToFix: 'Instala el SDK de .NET (`brew install --cask dotnet-sdk` o desde dot.net) para verificar tipos y compilación C#.'
        });
      } else {
        commands.push('dotnet build --no-restore --nologo');
        outputs.push(dotnetRes.stdout || dotnetRes.stderr || 'dotnet build OK');
        if (dotnetRes.exitCode !== 0) {
          hardFailed = true;
          findings.push({
            severity: 'error',
            title: 'dotnet build detectó errores de compilación o tipos en C#/.NET',
            reason: (dotnetRes.stdout || dotnetRes.stderr).slice(0, 500),
            howToFix: 'Ejecuta `dotnet build` en local y corrige los errores CS/MSB reportados.'
          });
        }
      }
    }

    const durationMs = Date.now() - startedAt;

    if (commands.length === 0 && findings.length === 0) {
      return createStationResult({
        metadata: this.metadata,
        command: 'No aplica al stack actual',
        status: 'skipped',
        durationMs,
        summary: 'Proyecto sin TypeScript, PHPStan, analizador de Python ni proyecto .NET configurado.',
        rawOutput: 'Estación omitida limpiamente (sin falso verde).'
      });
    }

    const status = hardFailed ? 'fail' : findings.length > 0 ? 'warn' : 'pass';
    const summary = hardFailed
      ? 'El análisis estático detectó errores de tipos que deben corregirse antes del push.'
      : findings.length > 0
        ? 'Falta instalar el analizador estático recomendado para este stack.'
        : 'Análisis estático de tipos superado con 0 errores.';

    return createStationResult({
      metadata: this.metadata,
      command: commands.join(' && ') || 'Sin herramienta instalada',
      status,
      durationMs,
      summary,
      rawOutput: outputs.filter(Boolean).join('\n\n') || 'OK',
      findings
    });
  }
}
