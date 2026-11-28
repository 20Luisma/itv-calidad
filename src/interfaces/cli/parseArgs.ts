import { resolveLang, type SupportedLang } from '../../domain/i18n.js';

export interface CliOptions {
  readonly repoPath: string;
  readonly slowMotionMs: number;
  readonly minCoverage: number;
  readonly format: 'pretty' | 'json' | 'markdown';
  readonly showHelp: boolean;
  readonly startMcp: boolean;
  readonly initHook: boolean;
  readonly force: boolean;
  readonly lang: SupportedLang;
  readonly targetUrl?: string;
}

export function parseCliArgs(argv: readonly string[], defaultRepoPath: string): CliOptions {
  let repoPath = defaultRepoPath;
  let slowMotionMs = 800;
  let minCoverage = 75;
  let format: 'pretty' | 'json' | 'markdown' = 'pretty';
  let showHelp = false;
  let startMcp = false;
  let initHook = false;
  let force = false;
  let lang: SupportedLang = 'es';
  let targetUrl: string | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] ?? '';
    if (arg === '--help' || arg === '-h') {
      showHelp = true;
    } else if (arg === '--mcp') {
      startMcp = true;
    } else if (arg === '--init-hook') {
      initHook = true;
    } else if (arg === '--force') {
      force = true;
    } else if (arg === '--lang' && argv[i + 1]) {
      lang = resolveLang(argv[i + 1]);
      i += 1;
    } else if (arg === '--fast') {
      slowMotionMs = 0;
    } else if (arg === '--json') {
      format = 'json';
      slowMotionMs = 0;
    } else if (arg === '--markdown' || arg === '--md') {
      format = 'markdown';
      slowMotionMs = 0;
    } else if (arg === '--url' && argv[i + 1]) {
      targetUrl = argv[i + 1]?.trim();
      i += 1;
    } else if (arg === '--delay' && argv[i + 1]) {
      const parsed = Number(argv[i + 1]);
      if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 10_000) {
        slowMotionMs = parsed;
      }
      i += 1;
    } else if (arg === '--min-coverage' && argv[i + 1]) {
      const parsed = Number(argv[i + 1]);
      if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 100) {
        minCoverage = parsed;
      }
      i += 1;
    } else if (!arg.startsWith('-')) {
      repoPath = arg;
    }
  }

  return {
    repoPath,
    slowMotionMs,
    minCoverage,
    format,
    showHelp,
    startMcp,
    initHook,
    force,
    lang,
    ...(targetUrl ? { targetUrl } : {})
  };
}
