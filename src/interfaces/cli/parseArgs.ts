export interface CliOptions {
  readonly repoPath: string;
  readonly slowMotionMs: number;
  readonly minCoverage: number;
  readonly format: 'pretty' | 'json' | 'markdown';
  readonly showHelp: boolean;
}

export function parseCliArgs(argv: readonly string[], defaultRepoPath: string): CliOptions {
  let repoPath = defaultRepoPath;
  let slowMotionMs = 800;
  let minCoverage = 75;
  let format: 'pretty' | 'json' | 'markdown' = 'pretty';
  let showHelp = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] ?? '';
    if (arg === '--help' || arg === '-h') {
      showHelp = true;
    } else if (arg === '--fast') {
      slowMotionMs = 0;
    } else if (arg === '--json') {
      format = 'json';
      slowMotionMs = 0;
    } else if (arg === '--markdown' || arg === '--md') {
      format = 'markdown';
      slowMotionMs = 0;
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
    showHelp
  };
}
