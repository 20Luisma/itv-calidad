import type { ExternalIntegrationLink, Finding } from '../../domain/types.js';

export interface SentryQueryResult {
  readonly link?: ExternalIntegrationLink;
  readonly findings: readonly Finding[];
  readonly logLine?: string;
}

export interface SentryClientOptions {
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
}

interface SentryIssueShape {
  readonly id?: string;
  readonly shortId?: string;
  readonly title?: string;
  readonly level?: string;
  readonly count?: string;
  readonly permalink?: string;
}

export async function querySentryIssues(
  options: SentryClientOptions = {}
): Promise<SentryQueryResult> {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 8000;

  const org = env.SENTRY_ORG?.trim();
  const project = env.SENTRY_PROJECT?.trim();
  const token = env.SENTRY_AUTH_TOKEN?.trim();
  const baseUrl = (env.SENTRY_BASE_URL?.trim() ?? 'https://sentry.io').replace(/\/+$/, '');

  if (!org || !project) {
    return { findings: [] };
  }

  const issuesPageUrl = `${baseUrl}/organizations/${encodeURIComponent(org)}/issues/?query=is%3Aunresolved`;

  if (!token) {
    return {
      link: {
        provider: 'sentry',
        label: `Abrir Sentry (${org}/${project})`,
        url: issuesPageUrl,
        status: 'not-configured',
        summary: 'Definí SENTRY_AUTH_TOKEN en .env para consultar los issues sin resolver en vivo.'
      },
      findings: [],
      logLine: `Sentry: ${org}/${project} configurado sin SENTRY_AUTH_TOKEN (enlace directo disponible).`
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  timer.unref();

  try {
    const apiUrl = `${baseUrl}/api/0/projects/${encodeURIComponent(org)}/${encodeURIComponent(project)}/issues/?query=is:unresolved&limit=5`;
    const res = await fetchImpl(apiUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json'
      },
      signal: controller.signal
    });

    if (!res.ok) {
      return {
        link: {
          provider: 'sentry',
          label: `Abrir Sentry (${org}/${project})`,
          url: issuesPageUrl,
          status: 'error',
          summary: `La API de Sentry respondió HTTP ${res.status}. Verificá SENTRY_AUTH_TOKEN, SENTRY_ORG y SENTRY_PROJECT.`
        },
        findings: [
          {
            severity: 'warning',
            title: `No se pudo consultar Sentry (HTTP ${res.status})`,
            reason: `La petición autenticada a Sentry devolvió código ${res.status}.`,
            howToFix: 'Verificá en `.env` que `SENTRY_AUTH_TOKEN` tenga permisos `project:read` y `event:read`.'
          }
        ],
        logLine: `Sentry API error: HTTP ${res.status} para ${org}/${project}.`
      };
    }

    const issues = (await res.json()) as SentryIssueShape[];
    const count = Array.isArray(issues) ? issues.length : 0;

    if (count === 0) {
      return {
        link: {
          provider: 'sentry',
          label: `Ver Sentry (${org}/${project})`,
          url: issuesPageUrl,
          status: 'connected',
          summary: '0 issues sin resolver en Sentry.'
        },
        findings: [],
        logLine: `Sentry (${org}/${project}): 0 issues sin resolver.`
      };
    }

    const sampleTitles = issues
      .slice(0, 3)
      .map((i) => `${i.shortId ?? 'ISSUE'}: ${i.title ?? 'Sin título'} (${i.count ?? '1'}x)`)
      .join(' | ');

    const findings: Finding[] = [
      {
        severity: 'warning',
        title: `Sentry reporta ${count} issue(s) sin resolver en ${org}/${project}`,
        reason: sampleTitles,
        howToFix: `Abrí Sentry (${issuesPageUrl}) para revisar los stacktraces antes de desplegar nuevos cambios.`
      }
    ];

    return {
      link: {
        provider: 'sentry',
        label: `Ver ${count} issue(s) en Sentry`,
        url: issuesPageUrl,
        status: 'connected',
        summary: `${count} issue(s) sin resolver: ${sampleTitles}`
      },
      findings,
      logLine: `Sentry (${org}/${project}): ${count} issue(s) sin resolver.`
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error de red';
    return {
      link: {
        provider: 'sentry',
        label: `Abrir Sentry (${org}/${project})`,
        url: issuesPageUrl,
        status: 'error',
        summary: `No se pudo conectar con Sentry (${msg}).`
      },
      findings: [
        {
          severity: 'warning',
          title: 'Sin conexión a la API de Sentry',
          reason: msg,
          howToFix: 'Verificá tu conexión a Internet o `SENTRY_BASE_URL` en `.env`.'
        }
      ],
      logLine: `Sentry sin conexión: ${msg}`
    };
  } finally {
    clearTimeout(timer);
  }
}
