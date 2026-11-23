import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ExternalIntegrationLink, Finding } from '../../domain/types.js';

export interface GitHubQueryResult {
  readonly link?: ExternalIntegrationLink;
  readonly findings: readonly Finding[];
  readonly logLine?: string;
}

export interface GitHubClientOptions {
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
}

export function parseGitHubRepoSlug(gitConfigContent: string): string | undefined {
  const httpsMatch = /https:\/\/github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?(?:\s|$)/i.exec(
    gitConfigContent
  );
  if (httpsMatch?.[1]) return httpsMatch[1];

  const sshMatch = /git@github\.com:([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?(?:\s|$)/i.exec(
    gitConfigContent
  );
  if (sshMatch?.[1]) return sshMatch[1];

  return undefined;
}

async function detectGitHubSlug(repoPath: string): Promise<string | undefined> {
  try {
    const raw = await readFile(path.join(repoPath, '.git', 'config'), 'utf8');
    return parseGitHubRepoSlug(raw);
  } catch {
    return undefined;
  }
}

interface DependabotAlertShape {
  readonly security_advisory?: {
    readonly severity?: string;
    readonly summary?: string;
  };
  readonly dependency?: {
    readonly package?: { readonly name?: string };
  };
}

export async function queryGitHubSecurity(
  repoPath: string,
  options: GitHubClientOptions = {}
): Promise<GitHubQueryResult> {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 8000;

  const slug = await detectGitHubSlug(repoPath);
  const token = env.GITHUB_TOKEN?.trim();

  if (!slug) {
    return { findings: [] };
  }

  const securityUrl = `https://github.com/${slug}/security`;

  if (!token) {
    return {
      link: {
        provider: 'github',
        label: `GitHub Security (${slug})`,
        url: securityUrl,
        status: 'not-configured',
        summary: 'Repositorio GitHub detectado. Definí GITHUB_TOKEN en Integraciones para consultar alertas Dependabot en vivo.'
      },
      findings: [],
      logLine: `GitHub Security: repo "${slug}" detectado (sin GITHUB_TOKEN; enlace directo disponible).`
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  timer.unref();

  try {
    const apiUrl = `https://api.github.com/repos/${slug}/dependabot/alerts?state=open&per_page=5`;
    const res = await fetchImpl(apiUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'itv-calidad-local'
      },
      signal: controller.signal
    });

    if (res.status === 403 || res.status === 404) {
      return {
        link: {
          provider: 'github',
          label: `GitHub Security (${slug})`,
          url: securityUrl,
          status: 'connected',
          summary: 'Token válido pero Dependabot alerts no está habilitado o falta permiso `security_events` en el token.'
        },
        findings: [],
        logLine: `GitHub Security (${slug}): Dependabot API devolvió HTTP ${res.status}.`
      };
    }

    if (!res.ok) {
      return {
        link: {
          provider: 'github',
          label: `GitHub Security (${slug})`,
          url: securityUrl,
          status: 'error',
          summary: `La API de GitHub respondió HTTP ${res.status}. Revisá GITHUB_TOKEN en Integraciones.`
        },
        findings: [
          {
            severity: 'warning',
            title: `No se pudo consultar GitHub Security (HTTP ${res.status})`,
            reason: `La petición a GitHub API devolvió código ${res.status}.`,
            howToFix: 'Verificá tu `GITHUB_TOKEN` en el panel de Integraciones.'
          }
        ],
        logLine: `GitHub Security API error: HTTP ${res.status}.`
      };
    }

    const alerts = (await res.json()) as DependabotAlertShape[];
    const count = Array.isArray(alerts) ? alerts.length : 0;

    if (count === 0) {
      return {
        link: {
          provider: 'github',
          label: `GitHub Security (${slug})`,
          url: securityUrl,
          status: 'connected',
          summary: '0 alertas abiertas de Dependabot en GitHub.'
        },
        findings: [],
        logLine: `GitHub Security (${slug}): 0 alertas abiertas de Dependabot.`
      };
    }

    const details = alerts
      .slice(0, 3)
      .map(
        (a) =>
          `${a.dependency?.package?.name ?? 'paquete'} (${a.security_advisory?.severity ?? 'alerta'})`
      )
      .join(', ');

    const hasHighOrCritical = alerts.some((a) =>
      ['critical', 'high'].includes((a.security_advisory?.severity ?? '').toLowerCase())
    );

    const findings: Finding[] = [
      {
        severity: hasHighOrCritical ? 'error' : 'warning',
        title: `GitHub Dependabot reporta ${count} alerta(s) abierta(s) en ${slug}`,
        reason: details,
        howToFix: `Abrí ${securityUrl} y actualizá las dependencias afectadas antes de desplegar.`
      }
    ];

    return {
      link: {
        provider: 'github',
        label: `GitHub Security (${count} alerta(s))`,
        url: securityUrl,
        status: 'connected',
        summary: `${count} alerta(s) abiertas: ${details}`
      },
      findings,
      logLine: `GitHub Security (${slug}): ${count} alerta(s) abierta(s).`
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error de red';
    return {
      link: {
        provider: 'github',
        label: `GitHub Security (${slug})`,
        url: securityUrl,
        status: 'error',
        summary: `Sin conexión a GitHub API (${msg}).`
      },
      findings: [],
      logLine: `GitHub Security sin conexión: ${msg}`
    };
  } finally {
    clearTimeout(timer);
  }
}
