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

export class E2eBrowserStation implements StationRunner {
  readonly metadata = STATION_CATALOG['e2e-browser'];

  async run(context: StationContext): Promise<StationResult> {
    const startedAt = Date.now();
    const { stack, repoPath, executor, commandTimeoutMs, signal } = context;

    if (!stack.hasPlaywright) {
      return createStationResult({
        metadata: this.metadata,
        command: 'Sin suite Playwright detectada',
        status: 'skipped',
        durationMs: Date.now() - startedAt,
        summary: 'El repositorio no tiene pruebas E2E de navegador configuradas (Playwright).',
        rawOutput:
          'No se encontró `playwright.config.*` ni scripts `test:e2e`/`e2e`. Omitido limpiamente sin falso verde.',
        findings: [
          {
            severity: 'info',
            title: 'Opcional: sumar pruebas E2E con Playwright',
            reason: 'Las pruebas E2E validan flujos reales de usuario (login, formularios, 404, rate-limit) en un navegador real.',
            howToFix: 'Si el proyecto tiene interfaz web, instalá Playwright con `npm init playwright@latest` y agregá un script `test:e2e`.'
          }
        ]
      });
    }

    let binary = 'npm';
    let args: string[] = [];

    if (stack.packageScripts['test:e2e']) {
      args = ['run', 'test:e2e'];
    } else if (stack.packageScripts.e2e) {
      args = ['run', 'e2e'];
    } else {
      const localPlaywright = path.join(repoPath, 'node_modules', '.bin', 'playwright');
      if (await exists(localPlaywright)) {
        binary = localPlaywright;
        args = ['test'];
      } else {
        binary = 'npx';
        args = ['--no-install', 'playwright', 'test'];
      }
    }

    const { res, combinedOutput } = await runStationCommand(context, binary, args);
    const durationMs = Date.now() - startedAt;

    if (res.notFound) {
      return createMissingBinaryResult({
        metadata: this.metadata,
        command: res.command,
        durationMs,
        summary: 'Playwright está configurado pero no instalado localmente.',
        rawOutput: combinedOutput,
        findingTitle: 'Binario de Playwright no encontrado',
        findingReason: res.stderr,
        howToFix: 'Ejecutá `npm install && npx playwright install` en el repositorio.'
      });
    }

    if (res.exitCode !== 0 || res.timedOut) {
      const findings: Finding[] = [
        {
          severity: 'error',
          title: res.timedOut ? 'Timeout en pruebas E2E' : 'Fallaron las pruebas E2E en navegador',
          reason: combinedOutput.slice(-600) || `Exit code ${String(res.exitCode)}`,
          howToFix: `Reproducí en local con \`${res.command}\` y revisá el reporte de Playwright para ver el paso exacto que falló.`
        }
      ];

      return createStationResult({
        metadata: this.metadata,
        command: res.command,
        status: 'fail',
        durationMs,
        summary: 'La suite E2E falló en navegador. Push bloqueado hasta corregir el flujo roto.',
        rawOutput: combinedOutput,
        findings
      });
    }

    return createStationResult({
      metadata: this.metadata,
      command: res.command,
      status: 'pass',
      durationMs,
      summary: 'Pruebas E2E en navegador superadas en verde.',
      rawOutput: combinedOutput || 'Playwright E2E OK'
    });
  }
}
