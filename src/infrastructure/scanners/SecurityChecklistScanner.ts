import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  Finding,
  RepoStack,
  SecurityChecklistItem,
  SecurityChecklistReport
} from '../../domain/types.js';
import { walkRepoFiles } from '../fs/RepoFileWalker.js';

const CODE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.php',
  '.py',
  '.htaccess',
  '.conf'
]);

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export interface SecurityChecklistInput {
  readonly repoPath: string;
  readonly stack: RepoStack;
  readonly secretFindings: readonly Finding[];
  readonly dependencyAuditStatus: 'pass' | 'fail' | 'skipped';
  readonly dependencyAuditDetail: string;
}

export async function buildSecurityChecklist(
  input: SecurityChecklistInput
): Promise<{
  checklist: SecurityChecklistReport;
  extraFindings: Finding[];
}> {
  const items: SecurityChecklistItem[] = [];
  const extraFindings: Finding[] = [];

  // 1. .gitignore protege .env
  const gitignorePath = path.join(input.repoPath, '.gitignore');
  let envProtected = false;
  if (await exists(gitignorePath)) {
    const content = await readFile(gitignorePath, 'utf8');
    envProtected = /(?:^|\n)\s*\.env(?:\s|$|\.)/m.test(content);
  }
  items.push({
    id: 'env-gitignore',
    category: 'automated',
    title: 'Protección de archivos .env en .gitignore',
    standardRef: 'OWASP ASVS V14.2 / RGPD Art. 32',
    status: envProtected ? 'pass' : 'warn',
    detail: envProtected
      ? '`.gitignore` excluye explícitamente archivos `.env`.'
      : 'No se encontró regla `.env` en `.gitignore` (o no existe `.gitignore`).',
    recommendation: 'Agregá `.env` y `.env.*` (excepto `.env.example`) en `.gitignore`.'
  });

  // 2. Cero secretos ni claves hardcodeadas
  const secretErrors = input.secretFindings.filter((f) => f.severity === 'error');
  items.push({
    id: 'no-hardcoded-secrets',
    category: 'automated',
    title: 'Ausencia de credenciales y claves privadas en código',
    standardRef: 'OWASP ASVS V2.10 / CWE-798',
    status: secretErrors.length === 0 ? 'pass' : 'fail',
    detail:
      secretErrors.length === 0
        ? 'El escáner local no detectó API keys, tokens ni claves privadas embebidas.'
        : `Se detectaron ${secretErrors.length} posible(s) credencial(es) hardcodeada(s).`,
    recommendation: 'Mové todo secreto a variables de entorno y rotá cualquier clave expuesta.'
  });

  // 3. Cero IPs http:// hardcodeadas
  const ipWarnings = input.secretFindings.filter((f) => f.severity === 'warning');
  items.push({
    id: 'no-plaintext-http-ips',
    category: 'automated',
    title: 'Transporte seguro (cero IPs http:// hardcodeadas)',
    standardRef: 'OWASP ASVS V9.1 / RGPD Art. 32(1)(a)',
    status: ipWarnings.length === 0 ? 'pass' : 'warn',
    detail:
      ipWarnings.length === 0
        ? 'No se detectaron IPs de infraestructura en `http://` plano dentro del código.'
        : `Se encontraron ${ipWarnings.length} referencia(s) a IPs en HTTP plano.`,
    recommendation: 'Configurá URLs vía `.env` con HTTPS obligatorio en producción.'
  });

  // 4. Dependencias auditadas y lockfile reproducible
  const [hasNpmLock, hasComposerLock, hasPoetryLock, hasPnpmLock, hasYarnLock] = await Promise.all([
    exists(path.join(input.repoPath, 'package-lock.json')),
    exists(path.join(input.repoPath, 'composer.lock')),
    exists(path.join(input.repoPath, 'poetry.lock')),
    exists(path.join(input.repoPath, 'pnpm-lock.yaml')),
    exists(path.join(input.repoPath, 'yarn.lock'))
  ]);
  const hasLockfile = hasNpmLock || hasComposerLock || hasPoetryLock || hasPnpmLock || hasYarnLock;

  const depsStatus =
    input.dependencyAuditStatus === 'fail'
      ? 'fail'
      : input.dependencyAuditStatus === 'pass' && hasLockfile
        ? 'pass'
        : 'warn';

  items.push({
    id: 'supply-chain-cves',
    category: 'automated',
    title: 'Auditoría de dependencias (CVEs) y lockfile versionado',
    standardRef: 'OWASP Top 10 A06 / ASVS V14.2',
    status: depsStatus,
    detail: `${input.dependencyAuditDetail} ${hasLockfile ? 'Lockfile presente.' : 'Sin lockfile detectado.'}`,
    recommendation: 'Mantené `package-lock.json`/`composer.lock` en Git y ejecutá auditoría en 0 CVEs antes de cada deploy.'
  });

  // 5. Escaneo de patrones peligrosos de ejecución / inyección + cabeceras HTTP
  const codeFiles = await walkRepoFiles(input.repoPath, CODE_EXTENSIONS, 300);
  let hasSecurityHeadersSignal = false;
  let dangerousPatternCount = 0;

  for (const file of codeFiles) {
    const normalized = file.relativePath.replace(/\\/g, '/');
    if (
      normalized.includes('SecurityChecklistScanner') ||
      normalized.includes('SafeCommandExecutor') ||
      normalized.startsWith('tests/')
    ) {
      continue;
    }

    if (
      /X-Content-Type-Options|X-Frame-Options|Content-Security-Policy|Strict-Transport-Security|helmet\(/i.test(
        file.content
      )
    ) {
      hasSecurityHeadersSignal = true;
    }

    const lines = file.content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] ?? '';
      if (/\beval\s*\(/.test(line) && !/^\s*\/\//.test(line)) {
        dangerousPatternCount += 1;
        extraFindings.push({
          severity: 'warning',
          title: 'Uso de eval() detectado',
          file: file.relativePath,
          line: i + 1,
          reason: '`eval()` ejecuta código dinámico y abre la puerta a inyección de código (CWE-95).',
          howToFix: 'Reemplazá `eval()` por parsers seguros (`JSON.parse`, mapas de funciones o validadores explícitos).'
        });
      }
      if (/shell\s*:\s*true/.test(line) && !/^\s*\/\//.test(line)) {
        dangerousPatternCount += 1;
        extraFindings.push({
          severity: 'warning',
          title: 'Ejecución de subproceso con shell: true',
          file: file.relativePath,
          line: i + 1,
          reason: 'Invocar subprocesos con `shell: true` facilita command injection si entra cualquier parámetro externo (CWE-78).',
          howToFix: 'Usá `spawn(bin, args, { shell: false })` pasando argumentos en un array.'
        });
      }
    }
  }

  items.push({
    id: 'anti-injection-patterns',
    category: 'automated',
    title: 'Ausencia de patrones críticos de inyección (eval / shell: true)',
    standardRef: 'OWASP Top 10 A03 / CWE-78 / CWE-95',
    status: dangerousPatternCount === 0 ? 'pass' : 'warn',
    detail:
      dangerousPatternCount === 0
        ? `Escaneados ${codeFiles.length} archivos sin ` + '`eval()` ni `shell: true`.'
        : `Se detectaron ${dangerousPatternCount} patrón(es) de riesgo que conviene revisar.`,
    recommendation: 'Evitá `eval()`, usá consultas parametrizadas (prepared statements) y `spawn` con `shell: false`.'
  });

  // 6. Cabeceras HTTP de seguridad (si parece haber servidor/web)
  const htaccessExists = await exists(path.join(input.repoPath, '.htaccess'));
  const hasHeaders = hasSecurityHeadersSignal || htaccessExists;
  items.push({
    id: 'http-security-headers',
    category: 'automated',
    title: 'Cabeceras HTTP de endurecimiento (nosniff, frame-options, CSP)',
    standardRef: 'OWASP ASVS V14.4',
    status: hasHeaders ? 'pass' : 'warn',
    detail: hasHeaders
      ? 'Se detectó configuración de cabeceras de seguridad HTTP en el proyecto.'
      : 'No se detectaron cabeceras `X-Content-Type-Options` / `X-Frame-Options` / `CSP` en el código.',
    recommendation: 'Configurá `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN` y `Referrer-Policy` en tu servidor o middleware.'
  });

  // Bloque operativo / diligencia debida fuera del código (manual)
  items.push(
    {
      id: 'op-dpa-contract',
      category: 'operational',
      title: 'Contrato de desarrollo, limitación de responsabilidad y DPA (RGPD)',
      standardRef: 'RGPD Art. 28 (Encargado de Tratamiento)',
      status: 'manual',
      detail: 'Fuera del código: define quién es Responsable del dato (cliente) vs Encargado (desarrollador) y el alcance exacto de mantenimiento.',
      recommendation: 'Firmá contrato + anexo DPA antes de tocar datos reales de clientes y evaluá seguro de RC profesional.'
    },
    {
      id: 'op-auth-crypto',
      category: 'operational',
      title: 'Hashing fuerte de contraseñas, sesiones seguras y MFA en servidores',
      standardRef: 'OWASP ASVS V2 / V3',
      status: 'manual',
      detail: 'Fuera del código estático: contraseñas con Argon2id/bcrypt, cookies HttpOnly+Secure+SameSite y SSH con llave + MFA en paneles.',
      recommendation: 'Verificá que ningún panel admin o base de datos esté expuesto a Internet sin firewall ni MFA.'
    },
    {
      id: 'op-backups-incident',
      category: 'operational',
      title: 'Backups cifrados probados y plan de respuesta a brechas (72h)',
      standardRef: 'RGPD Art. 32 y Art. 33',
      status: 'manual',
      detail: 'Ante un incidente real, demostrar logs, backups restaurables y notificación en <72h marca la diferencia entre incidente y negligencia.',
      recommendation: 'Documentá en el repo quién avisa, cómo rotar claves y dónde están los respaldos cifrados.'
    },
    {
      id: 'op-audit-evidence',
      category: 'operational',
      title: 'Evidencia fechada de controles previos al despliegue',
      standardRef: 'ISO 27001 / Diligencia Debida',
      status: 'manual',
      detail: 'Guardá el informe exportado por esta ITV (JSON/Markdown) junto al tag o PR del release como prueba objetiva de controles.',
      recommendation: 'Usá el botón "Exportar evidencia" del dashboard o `--json` en el CLI antes de cada entrega.'
    }
  );

  const automatedItems = items.filter((item) => item.category === 'automated');
  const automatedPassed = automatedItems.filter((item) => item.status === 'pass').length;
  const scorePercent =
    automatedItems.length > 0
      ? Math.round((automatedPassed / automatedItems.length) * 100)
      : 100;

  return {
    checklist: {
      generatedAt: new Date().toISOString(),
      disclaimer:
        'Guía técnica de diligencia debida basada en OWASP ASVS Nivel 1 y medidas técnicas del Art. 32 RGPD. No constituye asesoramiento jurídico formal.',
      automatedPassed,
      automatedTotal: automatedItems.length,
      scorePercent,
      items
    },
    extraFindings
  };
}
