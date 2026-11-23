import { chmod, readFile, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export interface IntegrationsPublicStatus {
  readonly sonarConfigured: boolean;
  readonly sonarHostUrl: string;
  readonly sonarProjectKey: string;
  readonly sentryConfigured: boolean;
  readonly sentryOrg: string;
  readonly sentryProject: string;
  readonly githubConfigured: boolean;
  readonly activeNames: readonly string[];
}

export interface IntegrationsUpdatePayload {
  readonly sonarToken?: string;
  readonly clearSonarToken?: boolean;
  readonly sonarHostUrl?: string;
  readonly sonarProjectKey?: string;
  readonly sentryAuthToken?: string;
  readonly clearSentryToken?: boolean;
  readonly sentryOrg?: string;
  readonly sentryProject?: string;
  readonly githubToken?: string;
  readonly clearGithubToken?: boolean;
}

const MANAGED_KEYS = new Set([
  'SONAR_TOKEN',
  'SONAR_HOST_URL',
  'SONAR_PROJECT_KEY',
  'SENTRY_AUTH_TOKEN',
  'SENTRY_ORG',
  'SENTRY_PROJECT',
  'GITHUB_TOKEN'
]);

/**
 * Carga variables desde un archivo `.env` local sin pisar las ya definidas en `process.env`.
 */
export function loadLocalEnv(baseDir = process.cwd()): void {
  const envPath = path.join(baseDir, '.env');
  let content: string;
  try {
    content = readFileSync(envPath, 'utf8');
  } catch {
    return;
  }

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIndex = line.indexOf('=');
    if (eqIndex <= 0) continue;

    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();
    if (!key || key in process.env) continue;

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

export function getIntegrationsStatus(
  env: Readonly<Record<string, string | undefined>> = process.env
): IntegrationsPublicStatus {
  const sonarConfigured = Boolean(env.SONAR_TOKEN?.trim());
  const sentryConfigured = Boolean(
    env.SENTRY_AUTH_TOKEN?.trim() && env.SENTRY_ORG?.trim() && env.SENTRY_PROJECT?.trim()
  );
  const githubConfigured = Boolean(env.GITHUB_TOKEN?.trim());

  const activeNames: string[] = [];
  if (sonarConfigured) activeNames.push('Sonar');
  if (sentryConfigured) activeNames.push('Sentry');
  if (githubConfigured) activeNames.push('GitHub');

  return {
    sonarConfigured,
    sonarHostUrl: env.SONAR_HOST_URL?.trim() || 'https://sonarcloud.io',
    sonarProjectKey: env.SONAR_PROJECT_KEY?.trim() || '',
    sentryConfigured,
    sentryOrg: env.SENTRY_ORG?.trim() || '',
    sentryProject: env.SENTRY_PROJECT?.trim() || '',
    githubConfigured,
    activeNames
  };
}

function sanitizeEnvValue(val: string): string {
  return val.replace(/[\r\n]/g, '').trim();
}

export async function saveIntegrationsEnv(
  payload: IntegrationsUpdatePayload,
  baseDir = process.cwd(),
  targetEnv: Record<string, string | undefined> = process.env
): Promise<IntegrationsPublicStatus> {
  const envPath = path.join(baseDir, '.env');
  let existingLines: string[] = [];

  try {
    const raw = await readFile(envPath, 'utf8');
    existingLines = raw.split(/\r?\n/);
  } catch {
    existingLines = [];
  }

  // Preservar líneas no gestionadas por integraciones
  const preserved: string[] = [];
  const currentManaged = new Map<string, string>();

  for (const line of existingLines) {
    const trimmed = line.trim();
    const eqIndex = trimmed.indexOf('=');
    if (trimmed && !trimmed.startsWith('#') && eqIndex > 0) {
      const key = trimmed.slice(0, eqIndex).trim();
      const val = trimmed.slice(eqIndex + 1).trim();
      if (MANAGED_KEYS.has(key)) {
        currentManaged.set(key, val);
        continue;
      }
    }
    preserved.push(line);
  }

  const applyField = (key: string, value: string | undefined, clearFlag?: boolean) => {
    if (clearFlag) {
      currentManaged.delete(key);
      delete targetEnv[key];
      return;
    }
    if (value !== undefined) {
      const clean = sanitizeEnvValue(value);
      if (clean) {
        currentManaged.set(key, clean);
        targetEnv[key] = clean;
      } else {
        currentManaged.delete(key);
        delete targetEnv[key];
      }
    }
  };

  if (payload.clearSonarToken) {
    applyField('SONAR_TOKEN', undefined, true);
  } else if (payload.sonarToken && payload.sonarToken.trim()) {
    applyField('SONAR_TOKEN', payload.sonarToken);
  }
  if (payload.sonarHostUrl !== undefined) {
    applyField('SONAR_HOST_URL', payload.sonarHostUrl);
  }
  if (payload.sonarProjectKey !== undefined) {
    applyField('SONAR_PROJECT_KEY', payload.sonarProjectKey);
  }

  if (payload.clearSentryToken) {
    applyField('SENTRY_AUTH_TOKEN', undefined, true);
  } else if (payload.sentryAuthToken && payload.sentryAuthToken.trim()) {
    applyField('SENTRY_AUTH_TOKEN', payload.sentryAuthToken);
  }
  if (payload.sentryOrg !== undefined) {
    applyField('SENTRY_ORG', payload.sentryOrg);
  }
  if (payload.sentryProject !== undefined) {
    applyField('SENTRY_PROJECT', payload.sentryProject);
  }

  if (payload.clearGithubToken) {
    applyField('GITHUB_TOKEN', undefined, true);
  } else if (payload.githubToken && payload.githubToken.trim()) {
    applyField('GITHUB_TOKEN', payload.githubToken);
  }

  const cleanedPreserved = preserved.filter((line, idx, arr) => {
    if (idx === arr.length - 1 && line === '') return false;
    return true;
  });

  const managedLines: string[] = [];
  for (const key of MANAGED_KEYS) {
    const val = currentManaged.get(key);
    if (val) managedLines.push(`${key}=${val}`);
  }

  const finalContent = [...cleanedPreserved, ...managedLines].join('\n').trim() + '\n';
  await writeFile(envPath, finalContent, { encoding: 'utf8', mode: 0o600 });
  try {
    await chmod(envPath, 0o600);
  } catch {
    // En sistemas sin chmod POSIX no romper
  }

  return getIntegrationsStatus(targetEnv);
}
