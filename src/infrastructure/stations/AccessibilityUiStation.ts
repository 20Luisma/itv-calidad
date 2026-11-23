import { STATION_CATALOG } from '../../domain/catalog.js';
import { createStationResult } from '../../domain/report.js';
import type { Finding, StationContext, StationResult, StationRunner } from '../../domain/types.js';
import { scanStaticHtmlAccessibility } from '../scanners/StaticHtmlA11yScanner.js';

export class AccessibilityUiStation implements StationRunner {
  readonly metadata = STATION_CATALOG['accessibility-ui'];

  async run(context: StationContext): Promise<StationResult> {
    const startedAt = Date.now();
    const { stack, repoPath, executor, commandTimeoutMs, signal } = context;
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

    // 2. Auditoría estática didáctica de archivos HTML del repositorio
    const staticScan = await scanStaticHtmlAccessibility(repoPath);
    if (staticScan.filesScanned > 0) {
      commands.push(`auditoría estática HTML WCAG (${staticScan.filesScanned} archivo(s))`);
      findings.push(...staticScan.findings);
      if (staticScan.findings.some((f) => f.severity === 'error')) {
        hardFailed = true;
      }
      outputs.push(
        staticScan.findings.length === 0
          ? `Auditoría HTML estática: ${staticScan.filesScanned} archivo(s) sin errores de alt, lang, labels ni botones vacíos.`
          : `Auditoría HTML estática: ${staticScan.findings.length} hallazgo(s) en ${staticScan.filesScanned} archivo(s).`
      );
    }

    const durationMs = Date.now() - startedAt;

    if (commands.length === 0) {
      return createStationResult({
        metadata: this.metadata,
        command: 'Sin vistas HTML ni herramientas WCAG configuradas',
        status: 'skipped',
        durationMs,
        summary: 'Proyecto sin archivos HTML estáticos ni suite Axe/Pa11y/Lighthouse configurada.',
        rawOutput: 'Estación omitida limpiamente (proyecto CLI/API sin interfaz web detectada).'
      });
    }

    const status = hardFailed ? 'fail' : findings.length > 0 ? 'warn' : 'pass';
    const summary = hardFailed
      ? `Accesibilidad con fallos críticos (${findings.filter((f) => f.severity === 'error').length} error(es) WCAG).`
      : findings.length > 0
        ? `Accesibilidad aceptable con ${findings.length} recomendación(es) de mejora.`
        : 'Accesibilidad y calidad HTML superadas en verde.';

    return createStationResult({
      metadata: this.metadata,
      command: commands.join(' && '),
      status,
      durationMs,
      summary,
      rawOutput: outputs.filter(Boolean).join('\n\n'),
      findings,
      metrics: {
        htmlFilesScanned: staticScan.filesScanned
      }
    });
  }
}
