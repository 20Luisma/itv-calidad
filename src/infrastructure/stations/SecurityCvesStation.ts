import { STATION_CATALOG } from '../../domain/catalog.js';
import { createStationResult } from '../../domain/report.js';
import type { Finding, StationContext, StationResult, StationRunner } from '../../domain/types.js';
import { scanSecretsAndIps } from '../scanners/SecretAndIpScanner.js';
import { buildSecurityChecklist } from '../scanners/SecurityChecklistScanner.js';

export class SecurityCvesStation implements StationRunner {
  readonly metadata = STATION_CATALOG['security-cves'];

  async run(context: StationContext): Promise<StationResult> {
    const startedAt = Date.now();
    const { stack, repoPath, executor, commandTimeoutMs, signal } = context;
    const findings: Finding[] = [];
    const outputs: string[] = [];
    const commands: string[] = [];

    let dependencyAuditStatus: 'pass' | 'fail' | 'skipped' = 'skipped';
    let dependencyAuditDetail = 'Sin gestor de dependencias auditable detectado.';
    let hardFailed = false;

    // 1. Auditoría de dependencias (CVEs)
    if (stack.hasPackageJson) {
      const res = await executor.run('npm', ['audit', '--audit-level=moderate'], {
        cwd: repoPath,
        timeoutMs: commandTimeoutMs,
        ...(signal ? { signal } : {})
      });
      commands.push(res.command);
      const out = [res.stdout, res.stderr].filter(Boolean).join('\n');
      outputs.push(out || 'npm audit: 0 vulnerabilidades');

      if (res.notFound) {
        dependencyAuditStatus = 'skipped';
        dependencyAuditDetail = 'npm no encontrado en PATH.';
      } else if (res.exitCode === 0) {
        dependencyAuditStatus = 'pass';
        dependencyAuditDetail = 'npm audit: 0 vulnerabilidades moderadas/altas/críticas.';
      } else if (/ENOLOCK|audit endpoint returned an error|ENOTFOUND|EAI_AGAIN/i.test(out)) {
        dependencyAuditStatus = 'skipped';
        dependencyAuditDetail = 'No se pudo completar npm audit (falta package-lock.json o sin acceso a red).';
        findings.push({
          severity: 'warning',
          title: 'npm audit no pudo completarse',
          reason: out.slice(0, 350),
          howToFix: 'Asegurate de tener `package-lock.json` generado y conexión para validar CVEs.'
        });
      } else {
        hardFailed = true;
        dependencyAuditStatus = 'fail';
        dependencyAuditDetail = 'npm audit reportó vulnerabilidades conocidas (CVEs).';
        findings.push({
          severity: 'error',
          title: 'Vulnerabilidades (CVEs) detectadas por npm audit',
          reason: out.slice(0, 500),
          howToFix: 'Ejecutá `npm audit` y actualizá las dependencias afectadas (`npm audit fix` o upgrade de versión).'
        });
      }
    }

    if (stack.hasComposerJson) {
      const res = await executor.run('composer', ['audit', '--no-interaction'], {
        cwd: repoPath,
        timeoutMs: commandTimeoutMs,
        ...(signal ? { signal } : {})
      });
      commands.push(res.command);
      const out = [res.stdout, res.stderr].filter(Boolean).join('\n');
      outputs.push(out || 'composer audit: 0 vulnerabilidades');

      if (res.notFound) {
        findings.push({
          severity: 'warning',
          title: 'composer no encontrado para auditar CVEs PHP',
          reason: res.stderr,
          howToFix: 'Instalá Composer para correr `composer audit`.'
        });
      } else if (res.exitCode === 0) {
        if (dependencyAuditStatus !== 'fail') {
          dependencyAuditStatus = 'pass';
          dependencyAuditDetail = 'composer audit: 0 vulnerabilidades conocidas.';
        }
      } else {
        hardFailed = true;
        dependencyAuditStatus = 'fail';
        dependencyAuditDetail = 'composer audit reportó vulnerabilidades conocidas.';
        findings.push({
          severity: 'error',
          title: 'Vulnerabilidades (CVEs) detectadas por composer audit',
          reason: out.slice(0, 500),
          howToFix: 'Actualizá los paquetes vulnerables con `composer update` y re-ejecutá `composer audit`.'
        });
      }
    }

    if (stack.hasPythonProject) {
      const res = await executor.run('pip-audit', [], {
        cwd: repoPath,
        timeoutMs: commandTimeoutMs,
        ...(signal ? { signal } : {})
      });
      if (!res.notFound) {
        commands.push('pip-audit');
        const out = [res.stdout, res.stderr].filter(Boolean).join('\n');
        outputs.push(out || 'pip-audit OK');
        if (res.exitCode === 0) {
          if (dependencyAuditStatus !== 'fail') {
            dependencyAuditStatus = 'pass';
            dependencyAuditDetail = 'pip-audit: 0 vulnerabilidades conocidas.';
          }
        } else {
          hardFailed = true;
          dependencyAuditStatus = 'fail';
          dependencyAuditDetail = 'pip-audit detectó dependencias Python vulnerables.';
          findings.push({
            severity: 'error',
            title: 'Vulnerabilidades detectadas por pip-audit',
            reason: out.slice(0, 500),
            howToFix: 'Actualizá los paquetes vulnerables en `requirements.txt` o `pyproject.toml`.'
          });
        }
      }
    }

    // 2. Escáner local de secretos e IPs http:// hardcodeadas
    const secretScan = await scanSecretsAndIps(repoPath);
    commands.push(`escáner local de secretos e IPs (${secretScan.filesScanned} archivos)`);
    findings.push(...secretScan.findings);

    if (secretScan.findings.some((f) => f.severity === 'error')) {
      hardFailed = true;
    }

    // 3. Checklist de Tranquilidad / Diligencia Debida en Seguridad (OWASP ASVS + RGPD Art. 32)
    const { checklist, extraFindings } = await buildSecurityChecklist({
      repoPath,
      stack,
      secretFindings: secretScan.findings,
      dependencyAuditStatus,
      dependencyAuditDetail
    });
    findings.push(...extraFindings);

    outputs.push(
      `Checklist de Tranquilidad en Seguridad: ${checklist.automatedPassed}/${checklist.automatedTotal} controles automáticos en verde (${checklist.scorePercent}%).`
    );

    const status = hardFailed ? 'fail' : findings.length > 0 ? 'warn' : 'pass';
    const summary = hardFailed
      ? 'Seguridad comprometida: se detectaron CVEs o credenciales expuestas. Push bloqueado.'
      : findings.length > 0
        ? `Sin CVEs críticos ni secretos expuestos, con ${findings.length} observación(es) de endurecimiento (${checklist.scorePercent}% checklist).`
        : `Seguridad impecable: 0 CVEs, 0 secretos expuestos y checklist técnico al ${checklist.scorePercent}%.`;

    return createStationResult({
      metadata: this.metadata,
      command: commands.join(' && '),
      status,
      durationMs: Date.now() - startedAt,
      summary,
      rawOutput: outputs.filter(Boolean).join('\n\n'),
      findings,
      metrics: {
        filesScanned: secretScan.filesScanned,
        checklistScore: `${checklist.scorePercent}% (${checklist.automatedPassed}/${checklist.automatedTotal})`
      },
      securityChecklist: checklist
    });
  }
}
