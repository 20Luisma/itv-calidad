import { access } from 'node:fs/promises';
import { STATION_CATALOG } from '../../domain/catalog.js';
import { createStationResult } from '../../domain/report.js';
import type { Finding, StationContext, StationResult, StationRunner } from '../../domain/types.js';
import { scanStaticHtmlAccessibility } from '../scanners/StaticHtmlA11yScanner.js';

const MAC_CHROME_PATHS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'
] as const;

export function isValidTargetUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isBrowserEnvironmentError(output: string): boolean {
  return /Could not find Chrome|Failed to launch the browser|ChromeLauncher|BrowserLauncher|ERR_CONNECTION_REFUSED|ECONNREFUSED|ProtocolError/i.test(
    output
  );
}

async function detectLocalChromeExecutable(): Promise<string | undefined> {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  for (const candidate of MAC_CHROME_PATHS) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Probar siguiente candidato
    }
  }
  return undefined;
}

export class AccessibilityUiStation implements StationRunner {
  readonly metadata = STATION_CATALOG['accessibility-ui'];

  async run(context: StationContext): Promise<StationResult> {
    const startedAt = Date.now();
    const { stack, repoPath, executor, commandTimeoutMs, targetUrl, signal } = context;
    const findings: Finding[] = [];
    const outputs: string[] = [];
    const commands: string[] = [];
    let hardFailed = false;

    // 1. Herramienta de accesibilidad configurada en el repo (Axe / Pa11y / Lighthouse)
    if (stack.hasAccessibilityTooling) {
      let scriptName: string | null = null;
      if (stack.packageScripts['test:a11y']) scriptName = 'test:a11y';
      else if (stack.packageScripts.a11y) scriptName = 'a11y';

      if (scriptName) {
        const res = await executor.run('npm', ['run', scriptName], {
          cwd: repoPath,
          timeoutMs: commandTimeoutMs,
          ...(signal ? { signal } : {})
        });
        commands.push(res.command);
        const out = [res.stdout, res.stderr].filter(Boolean).join('\n');
        outputs.push(out || `npm run ${scriptName} OK`);

        if (res.exitCode !== 0) {
          hardFailed = true;
          findings.push({
            severity: 'error',
            title: `Falló la auditoría de accesibilidad (npm run ${scriptName})`,
            reason: out.slice(-500) || `Exit code ${String(res.exitCode)}`,
            howToFix: `Ejecutá \`npm run ${scriptName}\` y corregí las violaciones WCAG 2.1 AA reportadas.`
          });
        }
      }
    }

    // 2. Auditoría WCAG 2.1 AA en vivo sobre URL local opcional (pa11y)
    if (targetUrl) {
      if (!isValidTargetUrl(targetUrl)) {
        findings.push({
          severity: 'warning',
          title: 'URL de auditoría en vivo inválida',
          reason: `La URL "${targetUrl}" no usa protocolo http:// o https:// válido.`,
          howToFix: 'Indicá una URL local válida como `http://127.0.0.1:4173` o `http://localhost:8000`.'
        });
      } else {
        const chromePath = await detectLocalChromeExecutable();
        const pa11yRes = await executor.run('pa11y', ['--standard', 'WCAG2AA', targetUrl], {
          cwd: repoPath,
          timeoutMs: commandTimeoutMs,
          ...(chromePath ? { env: { PUPPETEER_EXECUTABLE_PATH: chromePath } } : {}),
          ...(signal ? { signal } : {})
        });
        commands.push(pa11yRes.command);
        const out = [pa11yRes.stdout, pa11yRes.stderr].filter(Boolean).join('\n');

        if (pa11yRes.notFound) {
          outputs.push('pa11y no está instalado globalmente en esta máquina.');
          findings.push({
            severity: 'warning',
            title: 'Binario pa11y no instalado para auditar URL en vivo',
            reason: 'Pediste auditar una URL viva (contraste y DOM real), pero `pa11y` no está en PATH.',
            howToFix: 'Instalá Pa11y globalmente con `npm install -g pa11y` para auditar contraste y WCAG 2.1 AA sobre cualquier URL local.'
          });
        } else if (pa11yRes.exitCode !== 0 && isBrowserEnvironmentError(out)) {
          outputs.push(out);
          findings.push({
            severity: 'warning',
            title: `Entorno de navegador / URL no disponible para pa11y (${targetUrl})`,
            reason: 'Pa11y/Puppeteer falló al iniciar Chrome o conectarse a la URL; esto es un fallo de entorno, no una violación WCAG.',
            howToFix: 'Verificá que la URL esté levantada y que Puppeteer tenga navegador disponible (`npx puppeteer browsers install chrome` o `PUPPETEER_EXECUTABLE_PATH`).'
          });
        } else if (pa11yRes.exitCode !== 0) {
          hardFailed = true;
          outputs.push(out);
          findings.push({
            severity: 'error',
            title: `Violaciones WCAG 2.1 AA detectadas en vivo (${targetUrl})`,
            reason: out.slice(-600) || `pa11y devolvió exit code ${String(pa11yRes.exitCode)}`,
            howToFix: `Revisá los contrastes, etiquetas ARIA o elementos reportados por \`pa11y --standard WCAG2AA ${targetUrl}\`.`
          });
        } else {
          outputs.push(out || `pa11y WCAG2AA sobre ${targetUrl}: 0 errores.`);
        }
      }
    }

    // 3. Auditoría estática didáctica de vistas (.html, .htm, .php, .jsx, .tsx, .vue)
    const staticScan = await scanStaticHtmlAccessibility(repoPath);
    if (staticScan.filesScanned > 0) {
      commands.push(`auditoría estática WCAG en vistas (${staticScan.filesScanned} archivo(s))`);
      findings.push(...staticScan.findings);
      if (staticScan.findings.some((f) => f.severity === 'error')) {
        hardFailed = true;
      }
      outputs.push(
        staticScan.findings.length === 0
          ? `Auditoría estática de vistas: ${staticScan.filesScanned} archivo(s) sin errores de alt, lang, labels, links ni headings.`
          : `Auditoría estática de vistas: ${staticScan.findings.length} hallazgo(s) en ${staticScan.filesScanned} archivo(s).`
      );
    }

    const durationMs = Date.now() - startedAt;

    if (commands.length === 0) {
      return createStationResult({
        metadata: this.metadata,
        command: 'Sin vistas HTML/PHP/JSX ni herramientas WCAG configuradas',
        status: 'skipped',
        durationMs,
        summary: 'Proyecto sin vistas web ni suite Axe/Pa11y/Lighthouse configurada.',
        rawOutput: 'Estación omitida limpiamente (proyecto CLI/API sin interfaz web detectada).'
      });
    }

    const status = hardFailed ? 'fail' : findings.length > 0 ? 'warn' : 'pass';
    const summary = hardFailed
      ? `Accesibilidad con fallos críticos (${findings.filter((f) => f.severity === 'error').length} error(es) WCAG).`
      : findings.length > 0
        ? `Accesibilidad aceptable con ${findings.length} recomendación(es) de mejora.`
        : 'Accesibilidad y calidad UI superadas en verde.';

    return createStationResult({
      metadata: this.metadata,
      command: commands.join(' && '),
      status,
      durationMs,
      summary,
      rawOutput: outputs.filter(Boolean).join('\n\n'),
      findings,
      metrics: {
        viewsScanned: staticScan.filesScanned
      }
    });
  }
}
