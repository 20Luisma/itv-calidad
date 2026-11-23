import type * as vscode from 'vscode';

export interface ExtensionIntegrationsStatus {
  sonarConfigured: boolean;
  sonarHostUrl: string;
  sonarProjectKey: string;
  sentryConfigured: boolean;
  sentryOrg: string;
  sentryProject: string;
  githubConfigured: boolean;
  activeCount: number;
}

export interface ExtensionIntegrationsUpdate {
  sonarToken?: string;
  clearSonarToken?: boolean;
  sonarHostUrl?: string;
  sonarProjectKey?: string;
  sentryAuthToken?: string;
  clearSentryToken?: boolean;
  sentryOrg?: string;
  sentryProject?: string;
  githubToken?: string;
  clearGithubToken?: boolean;
}

const SECRET_KEYS = {
  sonar: 'itvCalidad.sonarToken',
  sentry: 'itvCalidad.sentryAuthToken',
  github: 'itvCalidad.githubToken'
} as const;

const STATE_KEYS = {
  sonarHostUrl: 'itvCalidad.sonarHostUrl',
  sonarProjectKey: 'itvCalidad.sonarProjectKey',
  sentryOrg: 'itvCalidad.sentryOrg',
  sentryProject: 'itvCalidad.sentryProject'
} as const;

export class IntegrationsStore {
  constructor(private readonly context: vscode.ExtensionContext) {}

  async getPublicStatus(): Promise<ExtensionIntegrationsStatus> {
    const [sonarTok, sentryTok, githubTok] = await Promise.all([
      this.context.secrets.get(SECRET_KEYS.sonar),
      this.context.secrets.get(SECRET_KEYS.sentry),
      this.context.secrets.get(SECRET_KEYS.github)
    ]);

    const sonarConfigured = Boolean(sonarTok?.trim() || process.env['SONAR_TOKEN']?.trim());
    const sentryConfigured = Boolean(sentryTok?.trim() || process.env['SENTRY_AUTH_TOKEN']?.trim());
    const githubConfigured = Boolean(githubTok?.trim() || process.env['GITHUB_TOKEN']?.trim());

    const activeCount = [sonarConfigured, sentryConfigured, githubConfigured].filter(Boolean).length;

    return {
      sonarConfigured,
      sonarHostUrl: this.context.globalState.get<string>(STATE_KEYS.sonarHostUrl) ?? process.env['SONAR_HOST_URL'] ?? 'https://sonarcloud.io',
      sonarProjectKey: this.context.globalState.get<string>(STATE_KEYS.sonarProjectKey) ?? process.env['SONAR_PROJECT_KEY'] ?? '',
      sentryConfigured,
      sentryOrg: this.context.globalState.get<string>(STATE_KEYS.sentryOrg) ?? process.env['SENTRY_ORG'] ?? '',
      sentryProject: this.context.globalState.get<string>(STATE_KEYS.sentryProject) ?? process.env['SENTRY_PROJECT'] ?? '',
      githubConfigured,
      activeCount
    };
  }

  async save(update: ExtensionIntegrationsUpdate): Promise<ExtensionIntegrationsStatus> {
    if (update.clearSonarToken) {
      await this.context.secrets.delete(SECRET_KEYS.sonar);
      delete process.env['SONAR_TOKEN'];
    } else if (update.sonarToken?.trim()) {
      await this.context.secrets.store(SECRET_KEYS.sonar, update.sonarToken.trim());
    }

    if (update.clearSentryToken) {
      await this.context.secrets.delete(SECRET_KEYS.sentry);
      delete process.env['SENTRY_AUTH_TOKEN'];
    } else if (update.sentryAuthToken?.trim()) {
      await this.context.secrets.store(SECRET_KEYS.sentry, update.sentryAuthToken.trim());
    }

    if (update.clearGithubToken) {
      await this.context.secrets.delete(SECRET_KEYS.github);
      delete process.env['GITHUB_TOKEN'];
    } else if (update.githubToken?.trim()) {
      await this.context.secrets.store(SECRET_KEYS.github, update.githubToken.trim());
    }

    if (typeof update.sonarHostUrl === 'string') {
      await this.context.globalState.update(STATE_KEYS.sonarHostUrl, update.sonarHostUrl.trim());
    }
    if (typeof update.sonarProjectKey === 'string') {
      await this.context.globalState.update(STATE_KEYS.sonarProjectKey, update.sonarProjectKey.trim());
    }
    if (typeof update.sentryOrg === 'string') {
      await this.context.globalState.update(STATE_KEYS.sentryOrg, update.sentryOrg.trim());
    }
    if (typeof update.sentryProject === 'string') {
      await this.context.globalState.update(STATE_KEYS.sentryProject, update.sentryProject.trim());
    }

    await this.applyToProcessEnv();
    return this.getPublicStatus();
  }

  async applyToProcessEnv(): Promise<void> {
    const [sonarTok, sentryTok, githubTok] = await Promise.all([
      this.context.secrets.get(SECRET_KEYS.sonar),
      this.context.secrets.get(SECRET_KEYS.sentry),
      this.context.secrets.get(SECRET_KEYS.github)
    ]);

    if (sonarTok?.trim()) process.env['SONAR_TOKEN'] = sonarTok.trim();
    if (sentryTok?.trim()) process.env['SENTRY_AUTH_TOKEN'] = sentryTok.trim();
    if (githubTok?.trim()) process.env['GITHUB_TOKEN'] = githubTok.trim();

    const sonarHost = this.context.globalState.get<string>(STATE_KEYS.sonarHostUrl);
    const sonarKey = this.context.globalState.get<string>(STATE_KEYS.sonarProjectKey);
    const sentryOrg = this.context.globalState.get<string>(STATE_KEYS.sentryOrg);
    const sentryProj = this.context.globalState.get<string>(STATE_KEYS.sentryProject);

    if (sonarHost) process.env['SONAR_HOST_URL'] = sonarHost;
    if (sonarKey) process.env['SONAR_PROJECT_KEY'] = sonarKey;
    if (sentryOrg) process.env['SENTRY_ORG'] = sentryOrg;
    if (sentryProj) process.env['SENTRY_PROJECT'] = sentryProj;
  }
}
