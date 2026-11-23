import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ExternalIntegrationLink, Finding } from '../../domain/types.js';

export interface SonarQueryResult {
  readonly link?: ExternalIntegrationLink;
  readonly findings: readonly Finding[];
  readonly logLine?: string;
}

interface SonarProperties {
  readonly projectKey?: string;
  readonly hostUrl?: string;
}

async function readSonarProperties(repoPath: string): Promise<SonarProperties> {
  try {
    const raw = await readFile(path.join(repoPath, 'sonar-project.properties'), 'utf8');
    let projectKey: string | undefined;
    let hostUrl: string | undefined;

    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      if (trimmed.startsWith('sonar.projectKey=')) {
        projectKey = trimmed.slice('sonar.projectKey='.length).trim();
      } else if (trimmed.startsWith('sonar.host.url=')) {
        hostUrl = trimmed.slice('sonar.host.url='.length).trim().replace(/\/+$/, '');
      }
    }

    return {
      ...(projectKey ? { projectKey } : {}),
      ...(hostUrl ? { hostUrl } : {})
    };
  } catch {
    return {};
  }
}

export interface SonarClientOptions {
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
}

export async function querySonarCloud(
  repoPath: string,
  options: SonarClientOptions = {}
): Promise<SonarQueryResult> {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 8000;

  const props = await readSonarProperties(repoPath);
  const projectKey = props.projectKey ?? env.SONAR_PROJECT_KEY?.trim();
  const hostUrl = (props.hostUrl ?? env.SONAR_HOST_URL?.trim() ?? 'https://sonarcloud.io').replace(
    /\/+$/,
    ''
  );
  const token = env.SONAR_TOKEN?.trim();

  if (!projectKey) {
    return { findings: [] };
  }

  const dashboardUrl = `${hostUrl}/dashboard?id=${encodeURIComponent(projectKey)}`;

  if (!token) {
    return {
      link: {
        provider: 'sonarcloud',
        label: `Abrir SonarCloud (${projectKey})`,
        url: dashboardUrl,
        status: 'not-configured',
        summary: 'Proyecto detectado en sonar-project.properties. Definí SONAR_TOKEN en .env para consultar el Quality Gate en vivo.'
      },
      findings: [],
      logLine: `SonarCloud: proyecto "${projectKey}" detectado (sin SONAR_TOKEN en .env; enlace directo disponible).`
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  timer.unref();

  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    };

    const qgUrl = `${hostUrl}/api/qualitygates/project_status?projectKey=${encodeURIComponent(projectKey)}`;
    const measuresUrl = `${hostUrl}/api/measures/component?component=${encodeURIComponent(projectKey)}&metricKeys=bugs,vulnerabilities,code_smells,duplicated_lines_density,coverage`;

    const [qgRes, measuresRes] = await Promise.all([
      fetchImpl(qgUrl, { headers, signal: controller.signal }),
      fetchImpl(measuresUrl, { headers, signal: controller.signal })
    ]);

    if (!qgRes.ok) {
      return {
        link: {
          provider: 'sonarcloud',
          label: `Abrir SonarCloud (${projectKey})`,
          url: dashboardUrl,
          status: 'error',
          summary: `La API de Sonar respondió HTTP ${qgRes.status}. Verificá SONAR_TOKEN y permisos del proyecto.`
        },
        findings: [
          {
            severity: 'warning',
            title: `No se pudo consultar SonarCloud (HTTP ${qgRes.status})`,
            reason: `La petición autenticada a ${hostUrl} devolvió código ${qgRes.status}.`,
            howToFix: 'Revisá que `SONAR_TOKEN` en `.env` sea válido y tenga permiso Browse sobre el proyecto.'
          }
        ],
        logLine: `SonarCloud API error: HTTP ${qgRes.status} para "${projectKey}".`
      };
    }

    const qgJson = (await qgRes.json()) as {
      projectStatus?: { status?: string };
    };
    const gateStatus = qgJson.projectStatus?.status ?? 'NONE';

    const metricsSummary: string[] = [`Quality Gate: ${gateStatus}`];
    if (measuresRes.ok) {
      const mJson = (await measuresRes.json()) as {
        component?: { measures?: Array<{ metric: string; value?: string }> };
      };
      const map = new Map<string, string>();
      for (const m of mJson.component?.measures ?? []) {
        if (m.value !== undefined) map.set(m.metric, m.value);
      }
      if (map.has('bugs')) metricsSummary.push(`Bugs: ${map.get('bugs')}`);
      if (map.has('vulnerabilities')) metricsSummary.push(`Vulns: ${map.get('vulnerabilities')}`);
      if (map.has('code_smells')) metricsSummary.push(`Smells: ${map.get('code_smells')}`);
      if (map.has('duplicated_lines_density')) {
        metricsSummary.push(`Duplicación: ${map.get('duplicated_lines_density')}%`);
      }
      if (map.has('coverage')) metricsSummary.push(`Cobertura: ${map.get('coverage')}%`);
    }

    const summaryText = metricsSummary.join(' · ');
    const findings: Finding[] = [];

    if (gateStatus === 'ERROR') {
      findings.push({
        severity: 'error',
        title: `SonarCloud Quality Gate en ERROR (${projectKey})`,
        reason: summaryText,
        howToFix: `Abrí el panel de SonarCloud (${dashboardUrl}) y resolvé los blockers o bugs que rompen el Quality Gate.`
      });
    } else if (gateStatus === 'WARN') {
      findings.push({
        severity: 'warning',
        title: `SonarCloud Quality Gate con advertencias (${projectKey})`,
        reason: summaryText,
        howToFix: `Revisá las métricas en ${dashboardUrl}.`
      });
    }

    return {
      link: {
        provider: 'sonarcloud',
        label: `Ver en SonarCloud (${projectKey})`,
        url: dashboardUrl,
        status: 'connected',
        summary: summaryText
      },
      findings,
      logLine: `SonarCloud (${projectKey}): ${summaryText}`
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error de red';
    return {
      link: {
        provider: 'sonarcloud',
        label: `Abrir SonarCloud (${projectKey})`,
        url: dashboardUrl,
        status: 'error',
        summary: `No se pudo conectar con SonarCloud (${msg}).`
      },
      findings: [
        {
          severity: 'warning',
          title: 'Sin conexión a la API de SonarCloud',
          reason: msg,
          howToFix: 'Verificá tu conexión a Internet o `SONAR_HOST_URL` en `.env`.'
        }
      ],
      logLine: `SonarCloud sin conexión: ${msg}`
    };
  } finally {
    clearTimeout(timer);
  }
}
