import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { STATION_CATALOG } from '../../domain/catalog.js';
import { createStationResult } from '../../domain/report.js';
import type { Finding, StationContext, StationResult, StationRunner } from '../../domain/types.js';
import { walkRepoFiles } from '../fs/RepoFileWalker.js';

export class SyntaxConfigStation implements StationRunner {
  readonly metadata = STATION_CATALOG['syntax-config'];

  async run(context: StationContext): Promise<StationResult> {
    const startedAt = Date.now();
    const findings: Finding[] = [];
    const outputs: string[] = [];
    const commands: string[] = [];
    let hardFailed = false;

    const { stack, repoPath, executor, commandTimeoutMs, signal } = context;

    // 1. Validar manifiestos JSON del proyecto (siempre sin herramientas externas)
    if (stack.hasPackageJson) {
      commands.push('JSON.parse(package.json)');
      try {
        const raw = await readFile(path.join(repoPath, 'package.json'), 'utf8');
        JSON.parse(raw);
        outputs.push('package.json: JSON válido.');
      } catch (error) {
        hardFailed = true;
        const msg = error instanceof Error ? error.message : 'JSON inválido';
        outputs.push(`package.json inválido: ${msg}`);
        findings.push({
          severity: 'error',
          title: 'package.json con sintaxis JSON inválida',
          file: 'package.json',
          reason: msg,
          howToFix: 'Corregí las comas, llaves o comillas mal cerradas en `package.json`.'
        });
      }
    }

    if (stack.hasComposerJson) {
      const composerRes = await executor.run(
        'composer',
        ['validate', '--strict', '--no-check-publish'],
        { cwd: repoPath, timeoutMs: commandTimeoutMs, ...(signal ? { signal } : {}) }
      );
      commands.push(composerRes.command);
      if (composerRes.notFound) {
        outputs.push('composer no encontrado en PATH.');
        findings.push({
          severity: 'warning',
          title: 'Binario composer no instalado localmente',
          reason: 'El repo es PHP pero `composer` no está disponible en PATH.',
          howToFix: 'Instalá Composer localmente (`brew install composer`) para validar `composer.json`.'
        });
      } else {
        outputs.push(composerRes.stdout || composerRes.stderr || 'composer validate OK');
        if (composerRes.exitCode !== 0) {
          hardFailed = true;
          findings.push({
            severity: 'error',
            title: 'composer.json no pasa validación estricta',
            file: 'composer.json',
            reason: composerRes.stderr || composerRes.stdout || 'Error en composer validate',
            howToFix: 'Ejecutá `composer validate --strict` y corregí los errores reportados.'
          });
        }
      }

      // php -l sobre archivos PHP (muestra hasta 60 archivos para mantener rapidez)
      const phpFiles = await walkRepoFiles(repoPath, new Set(['.php']), 60);
      if (phpFiles.length > 0) {
        commands.push(`php -l (${phpFiles.length} archivos)`);
        for (const file of phpFiles) {
          const phpRes = await executor.run('php', ['-l', file.absolutePath], {
            cwd: repoPath,
            timeoutMs: 15_000,
            ...(signal ? { signal } : {})
          });
          if (phpRes.notFound) {
            findings.push({
              severity: 'warning',
              title: 'Binario php no instalado localmente',
              reason: 'No se pudo correr `php -l` porque `php` no está en PATH.',
              howToFix: 'Instalá PHP (`brew install php`) para auditar sintaxis PHP.'
            });
            break;
          }
          if (phpRes.exitCode !== 0) {
            hardFailed = true;
            outputs.push(phpRes.stderr || phpRes.stdout);
            findings.push({
              severity: 'error',
              title: 'Error de sintaxis PHP',
              file: file.relativePath,
              reason: phpRes.stderr || phpRes.stdout || 'Syntax error',
              howToFix: `Ejecutá \`php -l ${file.relativePath}\` y corregí el error de parseo.`
            });
          }
        }
      }
    }

    // 2. Node / JS: si existe script lint en package.json lo ejecuta, si no valida archivos .js/.mjs con node --check
    if (stack.hasPackageJson) {
      if (stack.packageScripts.lint) {
        const lintRes = await executor.run('npm', ['run', 'lint'], {
          cwd: repoPath,
          timeoutMs: commandTimeoutMs,
          ...(signal ? { signal } : {})
        });
        commands.push(lintRes.command);
        outputs.push(lintRes.stdout || lintRes.stderr || 'npm run lint OK');
        if (lintRes.exitCode !== 0) {
          hardFailed = true;
          findings.push({
            severity: 'error',
            title: 'Falló el linter del proyecto (npm run lint)',
            reason: (lintRes.stderr || lintRes.stdout).slice(0, 400),
            howToFix: 'Ejecutá `npm run lint` en local y corregí las reglas marcadas.'
          });
        }
      } else {
        const jsFiles = await walkRepoFiles(repoPath, new Set(['.js', '.mjs', '.cjs']), 40);
        if (jsFiles.length > 0) {
          commands.push(`node --check (${jsFiles.length} archivos JS)`);
          for (const file of jsFiles) {
            const checkRes = await executor.run(process.execPath, ['--check', file.absolutePath], {
              cwd: repoPath,
              timeoutMs: 10_000,
              ...(signal ? { signal } : {})
            });
            if (checkRes.exitCode !== 0) {
              hardFailed = true;
              outputs.push(checkRes.stderr || checkRes.stdout);
              findings.push({
                severity: 'error',
                title: 'Error de sintaxis JavaScript',
                file: file.relativePath,
                reason: checkRes.stderr || 'Error de parseo JS',
                howToFix: `Corregí la sintaxis en \`${file.relativePath}\` y verificá con \`node --check\`.`
              });
            }
          }
          if (!hardFailed) {
            outputs.push(`node --check: ${jsFiles.length} archivo(s) JS válidos.`);
          }
        }
      }
    }

    // 3. Python: py_compile
    if (stack.hasPythonProject) {
      const pyFiles = await walkRepoFiles(repoPath, new Set(['.py']), 50);
      if (pyFiles.length > 0) {
        const pyRes = await executor.run(
          'python3',
          ['-m', 'py_compile', ...pyFiles.map((f) => f.absolutePath)],
          { cwd: repoPath, timeoutMs: commandTimeoutMs, ...(signal ? { signal } : {}) }
        );
        commands.push(`python3 -m py_compile (${pyFiles.length} archivos)`);
        if (pyRes.notFound) {
          findings.push({
            severity: 'warning',
            title: 'python3 no encontrado en PATH',
            reason: 'No se pudo verificar sintaxis Python.',
            howToFix: 'Instalá Python 3 para habilitar la verificación de sintaxis.'
          });
        } else if (pyRes.exitCode !== 0) {
          hardFailed = true;
          outputs.push(pyRes.stderr || pyRes.stdout);
          findings.push({
            severity: 'error',
            title: 'Error de sintaxis Python',
            reason: pyRes.stderr || pyRes.stdout,
            howToFix: 'Corregí el error de sintaxis indicado por `py_compile`.'
          });
        } else {
          outputs.push(`py_compile: ${pyFiles.length} archivo(s) Python válidos.`);
        }
      }
    }

    const durationMs = Date.now() - startedAt;
    if (commands.length === 0) {
      return createStationResult({
        metadata: this.metadata,
        command: 'Sin manifiestos reconocidos',
        status: 'skipped',
        durationMs,
        summary: 'No se detectaron archivos PHP, Node/JS ni Python para validar sintaxis.',
        rawOutput: 'Stack no reconocido en la raíz del repositorio.',
        findings
      });
    }

    const status = hardFailed ? 'fail' : findings.length > 0 ? 'warn' : 'pass';
    const summary = hardFailed
      ? `Se detectaron ${findings.filter((f) => f.severity === 'error').length} error(es) de sintaxis o configuración.`
      : findings.length > 0
        ? 'Sintaxis revisada con observaciones (faltan binarios locales opcionales).'
        : 'Sintaxis y archivos de configuración 100% válidos.';

    return createStationResult({
      metadata: this.metadata,
      command: commands.join(' && '),
      status,
      durationMs,
      summary,
      rawOutput: outputs.filter(Boolean).join('\n\n') || 'OK',
      findings
    });
  }
}
