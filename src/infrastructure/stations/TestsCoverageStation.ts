import { access } from 'node:fs/promises';
import path from 'node:path';
import { STATION_CATALOG } from '../../domain/catalog.js';
import { createStationResult } from '../../domain/report.js';
import type { Finding, StationContext, StationResult, StationRunner } from '../../domain/types.js';
import { createMissingBinaryResult, runStationCommand } from './stationHelpers.js';

async function exists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

export function extractCoveragePercent(output: string): number | null {
  // Formato Vitest/Istanbul: "All files |   88.50 |"
  const allFilesMatch = /All files\s*\|\s*(\d+(?:\.\d+)?)/i.exec(output);
  if (allFilesMatch?.[1]) {
    return Number(allFilesMatch[1]);
  }
  // Formato Pytest-cov: "TOTAL   120   12   90%"
  const pytestMatch = /^TOTAL\s+\d+\s+\d+\s+(?:\d+\s+\d+\s+)?(\d+(?:\.\d+)?)%/m.exec(output);
  if (pytestMatch?.[1]) {
    return Number(pytestMatch[1]);
  }
  // Formato PHPUnit: "Lines:   82.50%"
  const phpunitMatch = /Lines:\s*(\d+(?:\.\d+)?)%/i.exec(output);
  if (phpunitMatch?.[1]) {
    return Number(phpunitMatch[1]);
  }
  // Formato Coverlet (.NET): "| Total | 84.2% |"
  const coverletMatch = /\|\s*Total\s*\|\s*(\d+(?:\.\d+)?)%/i.exec(output);
  if (coverletMatch?.[1]) {
    return Number(coverletMatch[1]);
  }
  return null;
}

export class TestsCoverageStation implements StationRunner {
  readonly metadata = STATION_CATALOG['tests-coverage'];

  async run(context: StationContext): Promise<StationResult> {
    const startedAt = Date.now();
    const { stack, repoPath, executor, commandTimeoutMs, minCoverage, signal } = context;
    const findings: Finding[] = [];

    let binary = '';
    let args: string[] = [];

    // Selección de suite según stack
    if (stack.primaryStack === 'php' || (stack.hasComposerJson && !stack.packageScripts.test)) {
      const localPhpunit = path.join(repoPath, 'vendor', 'bin', 'phpunit');
      if (await exists(localPhpunit)) {
        binary = localPhpunit;
        args = [];
      } else if (stack.composerScripts.test) {
        binary = 'composer';
        args = ['test'];
      }
    }

    if (!binary && stack.hasPackageJson) {
      if (stack.packageScripts['test:coverage']) {
        binary = 'npm';
        args = ['run', 'test:coverage'];
      } else if (
        stack.packageScripts.test &&
        !stack.packageScripts.test.includes('no test specified')
      ) {
        binary = 'npm';
        args = ['test'];
      }
    }

    if (!binary && stack.hasPythonProject) {
      binary = 'pytest';
      args = ['-q'];
    }

    if (!binary && stack.hasDotnetProject) {
      binary = 'dotnet';
      args = ['test', '--nologo'];
    }

    if (!binary) {
      return createStationResult({
        metadata: this.metadata,
        command: 'Sin suite de tests configurada',
        status: 'warn',
        durationMs: Date.now() - startedAt,
        summary: 'No se encontró ninguna suite de tests ejecutable en el repositorio.',
        rawOutput: 'No hay script `test` en package.json, ni `vendor/bin/phpunit`, ni proyecto Python con pytest.',
        findings: [
          {
            severity: 'warning',
            title: 'Repositorio sin suite de tests automáticos',
            reason: 'Sin tests locales no podés detectar regresiones antes de subir cambios.',
            howToFix: 'Configurá Vitest/Jest (Node), PHPUnit (PHP) o Pytest (Python) y un script `test`.'
          }
        ]
      });
    }

    const { res, combinedOutput } = await runStationCommand(context, binary, args);
    const durationMs = Date.now() - startedAt;

    if (res.notFound) {
      return createMissingBinaryResult({
        metadata: this.metadata,
        command: res.command,
        durationMs,
        summary: `No se encontró el ejecutable \`${binary}\` en el entorno local.`,
        rawOutput: combinedOutput,
        findingTitle: `Ejecutable ${binary} no disponible`,
        findingReason: res.stderr,
        howToFix: `Instalá \`${binary}\` o las dependencias del proyecto antes de correr la ITV.`
      });
    }

    if (res.exitCode !== 0 || res.timedOut) {
      findings.push({
        severity: 'error',
        title: res.timedOut ? 'Timeout ejecutando tests' : 'Fallaron uno o más tests automáticos',
        reason: combinedOutput.slice(-600) || `Código de salida ${String(res.exitCode)}`,
        howToFix: `Ejecutá \`${res.command}\` en local, reproducí el fallo y corregí el código o contrato roto.`
      });

      return createStationResult({
        metadata: this.metadata,
        command: res.command,
        status: 'fail',
        durationMs,
        summary: 'La suite de tests falló. Push bloqueado hasta poner los tests en verde.',
        rawOutput: combinedOutput,
        findings
      });
    }

    const coveragePercent = extractCoveragePercent(combinedOutput);
    const metrics: Record<string, number | string> = {
      minCoverageGate: `${minCoverage}%`
    };

    if (coveragePercent !== null) {
      metrics.coverage = `${coveragePercent}%`;
      if (coveragePercent < minCoverage) {
        findings.push({
          severity: 'error',
          title: `Cobertura insuficiente (${coveragePercent}% < ${minCoverage}%)`,
          reason: `La cobertura medida (${coveragePercent}%) está por debajo del umbral exigido (${minCoverage}%).`,
          howToFix: 'Agregá tests unitarios para las ramas y casos borde sin cubrir.'
        });
        return createStationResult({
          metadata: this.metadata,
          command: res.command,
          status: 'fail',
          durationMs,
          summary: `Tests en verde pero cobertura (${coveragePercent}%) debajo del mínimo (${minCoverage}%).`,
          rawOutput: combinedOutput,
          findings,
          metrics
        });
      }
    }

    return createStationResult({
      metadata: this.metadata,
      command: res.command,
      status: 'pass',
      durationMs,
      summary:
        coveragePercent !== null
          ? `Tests en verde con ${coveragePercent}% de cobertura (umbral ${minCoverage}%).`
          : 'Suite de tests ejecutada con éxito (100% en verde).',
      rawOutput: combinedOutput || 'Tests OK',
      findings,
      metrics
    });
  }
}
