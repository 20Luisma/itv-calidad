import type { Finding } from '../../domain/types.js';
import { walkRepoFiles } from '../fs/RepoFileWalker.js';

const SCANNABLE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.php',
  '.py',
  '.cs',
  '.config',
  '.sh',
  '.yml',
  '.yaml',
  '.json',
  '.env'
]);

interface SecurityRule {
  readonly id: string;
  readonly title: string;
  readonly severity: 'error' | 'warning';
  readonly pattern: RegExp;
  readonly reason: string;
  readonly howToFix: string;
  readonly ignoreIf?: (line: string, relativePath: string) => boolean;
}

const SECURITY_RULES: readonly SecurityRule[] = [
  {
    id: 'private-key',
    title: 'Clave privada embebida en el repositorio',
    severity: 'error',
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/,
    reason: 'Se detectó una cabecera de clave privada criptográfica dentro de un archivo versionable.',
    howToFix: 'Eliminá la clave del repo, rotala de inmediato y cargala desde secretos del sistema o variables de entorno.'
  },
  {
    id: 'aws-key',
    title: 'Posible AWS Access Key hardcodeada',
    severity: 'error',
    pattern: /\bAKIA[0-9A-Z]{16}\b/,
    reason: 'Patrón compatible con una clave de acceso de AWS en texto plano.',
    howToFix: 'Mové la credencial a `.env` (ignorado en `.gitignore`) y rotá la clave en AWS IAM.'
  },
  {
    id: 'github-token',
    title: 'Token de GitHub expuesto en código',
    severity: 'error',
    pattern: /\b(?:ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{22,})\b/,
    reason: 'Se encontró un Personal Access Token de GitHub hardcodeado.',
    howToFix: 'Revocá el token en GitHub Settings y leelo desde una variable de entorno.'
  },
  {
    id: 'provider-secret-key',
    title: 'API key secreta hardcodeada (sk- / sk_live_)',
    severity: 'error',
    pattern: /\b(?:sk-proj-[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9]{32,}|sk_live_[A-Za-z0-9]{20,})\b/,
    reason: 'Se detectó una API key secreta de proveedor externo en texto plano.',
    howToFix: 'Guardala en `.env` (fuera de Git), rotala y validá su existencia al arrancar la app.'
  },
  {
    id: 'hardcoded-http-ip',
    title: 'IP de infraestructura en HTTP plano hardcodeada',
    severity: 'warning',
    pattern: /http:\/\/(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?/i,
    reason: 'Se encontró una dirección IP en `http://` directamente en el código fuente.',
    howToFix: 'Leé la URL base desde una variable de entorno (`process.env` / `$_ENV` / `os.getenv`) con fallback seguro a `localhost` en desarrollo y HTTPS en producción.',
    ignoreIf: (line) =>
      /http:\/\/(?:127\.0\.0\.1|0\.0\.0\.0)\b/.test(line) ||
      /http:\/\/192\.0\.2\./.test(line)
  }
];

function isIgnoredFile(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, '/');
  return (
    normalized.endsWith('.env.example') ||
    normalized.endsWith('package-lock.json') ||
    normalized.endsWith('composer.lock') ||
    normalized.includes('SecretAndIpScanner')
  );
}

export async function scanSecretsAndIps(repoPath: string): Promise<{
  filesScanned: number;
  findings: Finding[];
}> {
  const files = await walkRepoFiles(repoPath, SCANNABLE_EXTENSIONS);
  const findings: Finding[] = [];

  for (const file of files) {
    if (isIgnoredFile(file.relativePath)) continue;

    // Archivo .env real dentro del repo: advertencia didáctica si no está vacío
    if (file.relativePath === '.env' || file.relativePath.endsWith('/.env')) {
      continue;
    }

    const lines = file.content.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index] ?? '';
      for (const rule of SECURITY_RULES) {
        if (!rule.pattern.test(line)) continue;
        if (rule.ignoreIf?.(line, file.relativePath)) continue;

        findings.push({
          severity: rule.severity,
          title: rule.title,
          file: file.relativePath,
          line: index + 1,
          reason: rule.reason,
          howToFix: rule.howToFix
        });
      }
    }
  }

  return {
    filesScanned: files.length,
    findings
  };
}
