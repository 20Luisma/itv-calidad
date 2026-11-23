import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Finding, RepoStack } from '../../domain/types.js';
import { walkRepoFiles } from '../fs/RepoFileWalker.js';

const OBSERVABILITY_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.php',
  '.py'
]);

const SENTRY_DSN_PATTERN = /https:\/\/[a-f0-9]{16,}@[a-z0-9.-]*sentry\.io\/\d+/i;
const SEND_DEFAULT_PII_PATTERN = /(?:sendDefaultPii\s*:\s*true|send_default_pii\s*=\s*True|'send_default_pii'\s*=>\s*true)/;

function isTestOrScanner(relativePath: string): boolean {
  const norm = relativePath.replace(/\\/g, '/');
  return (
    norm.startsWith('tests/') ||
    norm.includes('.test.') ||
    norm.includes('.spec.') ||
    norm.includes('ObservabilitySentryScanner')
  );
}

async function detectSentryInManifests(repoPath: string, stack: RepoStack): Promise<boolean> {
  if (stack.hasPackageJson) {
    try {
      const raw = await readFile(path.join(repoPath, 'package.json'), 'utf8');
      if (/@sentry\/|pino|winston/i.test(raw)) return true;
    } catch {
      // ignorar
    }
  }
  if (stack.hasComposerJson) {
    try {
      const raw = await readFile(path.join(repoPath, 'composer.json'), 'utf8');
      if (/sentry\/sentry|monolog\/monolog/i.test(raw)) return true;
    } catch {
      // ignorar
    }
  }
  return false;
}

export async function scanObservabilitySentry(
  repoPath: string,
  stack: RepoStack
): Promise<{
  hasObservability: boolean;
  sentryDetected: boolean;
  findings: Finding[];
}> {
  const findings: Finding[] = [];
  const allFiles = await walkRepoFiles(repoPath, OBSERVABILITY_EXTENSIONS, 250);
  const files = allFiles.filter((f) => !isTestOrScanner(f.relativePath));

  let hasManifestObservability = await detectSentryInManifests(repoPath, stack);
  let sentryDetected = false;
  let hasGlobalErrorHandler = false;

  for (const file of files) {
    const content = file.content;

    if (/Sentry\.init|Sentry\\init|sentry_sdk\.init|SENTRY_DSN/i.test(content)) {
      sentryDetected = true;
      hasManifestObservability = true;
    }

    if (
      /process\.on\s*\(\s*['"](?:unhandledRejection|uncaughtException)['"]|set_exception_handler|errorHandler|window\.addEventListener\s*\(\s*['"]error['"]/i.test(
        content
      )
    ) {
      hasGlobalErrorHandler = true;
    }

    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] ?? '';
      if (SENTRY_DSN_PATTERN.test(line)) {
        findings.push({
          severity: 'error',
          title: 'Sentry DSN hardcodeado en el código fuente',
          file: file.relativePath,
          line: i + 1,
          reason: 'Un DSN de Sentry embebido en el repositorio permite que terceros saturen tu cuota de eventos.',
          howToFix: 'Leé `SENTRY_DSN` desde `.env` (fail-safe: si está vacío, desactivá Sentry sin romper la app).'
        });
      }

      if (SEND_DEFAULT_PII_PATTERN.test(line)) {
        findings.push({
          severity: 'warning',
          title: 'Sentry configurado con sendDefaultPii activado (revisar RGPD)',
          file: file.relativePath,
          line: i + 1,
          reason: 'Activar `sendDefaultPii` envía automáticamente IPs, cookies o datos personales del usuario a Sentry.',
          howToFix: 'Dejalo en `false` salvo consentimiento/DPA explícito, y filtrá headers sensibles con `beforeSend`.'
        });
      }
    }
  }

  const hasObservability = hasManifestObservability || sentryDetected || hasGlobalErrorHandler;

  if (!hasObservability && stack.primaryStack !== 'unknown') {
    findings.push({
      severity: 'info',
      title: 'Sin observabilidad ni manejo global de errores detectado (Sentry / logs)',
      reason: 'No se detectó SDK de Sentry, logger estructurado ni handler global de excepciones para enterarte de fallos en producción.',
      howToFix: 'Agregá observabilidad fail-safe (ej. Sentry leyendo `SENTRY_DSN` desde `.env` o logs JSON estructurados que nunca rompan si falta configuración).'
    });
  }

  return {
    hasObservability,
    sentryDetected,
    findings
  };
}
