export type StackKind = 'node' | 'php' | 'python' | 'unknown';

export type StationId =
  | 'syntax-config'
  | 'static-types'
  | 'tests-coverage'
  | 'security-cves'
  | 'e2e-browser'
  | 'accessibility-ui';

export type StationStatus = 'pass' | 'warn' | 'fail' | 'skipped';

export type FindingSeverity = 'error' | 'warning' | 'info';

export type InspectionVerdict = 'APTO' | 'APTO_CON_OBSERVACIONES' | 'DESFAVORABLE';

export interface Finding {
  readonly severity: FindingSeverity;
  readonly title: string;
  readonly file?: string;
  readonly line?: number;
  readonly reason: string;
  readonly howToFix: string;
}

export interface DidacticInfo {
  readonly whatItChecks: string;
  readonly whyItMatters: string;
  readonly toolsByStack: string;
}

export interface StationMetadata {
  readonly id: StationId;
  readonly order: number;
  readonly name: string;
  readonly shortName: string;
  readonly didactic: DidacticInfo;
}

export type ChecklistCategory = 'automated' | 'operational';

export type ChecklistStatus = 'pass' | 'warn' | 'fail' | 'manual';

export interface SecurityChecklistItem {
  readonly id: string;
  readonly category: ChecklistCategory;
  readonly title: string;
  readonly standardRef: string;
  readonly status: ChecklistStatus;
  readonly detail: string;
  readonly recommendation: string;
}

export interface SecurityChecklistReport {
  readonly generatedAt: string;
  readonly disclaimer: string;
  readonly automatedPassed: number;
  readonly automatedTotal: number;
  readonly scorePercent: number;
  readonly items: readonly SecurityChecklistItem[];
}

export interface StationResult {
  readonly id: StationId;
  readonly order: number;
  readonly name: string;
  readonly shortName: string;
  readonly didacticExplanation: string;
  readonly whyItMatters: string;
  readonly command: string;
  readonly status: StationStatus;
  readonly durationMs: number;
  readonly summary: string;
  readonly rawOutput: string;
  readonly findings: readonly Finding[];
  readonly metrics?: Readonly<Record<string, number | string>>;
  readonly securityChecklist?: SecurityChecklistReport;
}

export interface RepoStack {
  readonly repoPath: string;
  readonly repoName: string;
  readonly primaryStack: StackKind;
  readonly detectedStacks: readonly StackKind[];
  readonly hasTypeScript: boolean;
  readonly hasPackageJson: boolean;
  readonly hasComposerJson: boolean;
  readonly hasPythonProject: boolean;
  readonly hasPlaywright: boolean;
  readonly hasAccessibilityTooling: boolean;
  readonly packageScripts: Readonly<Record<string, string>>;
  readonly composerScripts: Readonly<Record<string, string>>;
  readonly gitBranch?: string;
}

export interface InspectionOptions {
  readonly repoPath: string;
  readonly slowMotionMs?: number;
  readonly minCoverage?: number;
  readonly commandTimeoutMs?: number;
  readonly signal?: AbortSignal;
}

export interface InspectionSummary {
  readonly total: number;
  readonly passed: number;
  readonly warned: number;
  readonly failed: number;
  readonly skipped: number;
}

export interface InspectionReport {
  readonly inspectionId: string;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly totalDurationMs: number;
  readonly verdict: InspectionVerdict;
  readonly blocksPush: boolean;
  readonly stack: RepoStack;
  readonly summary: InspectionSummary;
  readonly stations: readonly StationResult[];
  readonly securityChecklist?: SecurityChecklistReport;
}

export type InspectionEvent =
  | {
      readonly type: 'inspection:start';
      readonly inspectionId: string;
      readonly stack: RepoStack;
      readonly totalStations: number;
      readonly slowMotionMs: number;
    }
  | {
      readonly type: 'station:start';
      readonly inspectionId: string;
      readonly station: StationMetadata;
    }
  | {
      readonly type: 'station:complete';
      readonly inspectionId: string;
      readonly result: StationResult;
    }
  | {
      readonly type: 'inspection:complete';
      readonly inspectionId: string;
      readonly report: InspectionReport;
    }
  | {
      readonly type: 'inspection:error';
      readonly inspectionId: string;
      readonly message: string;
    };

export type InspectionEventListener = (event: InspectionEvent) => void;

export interface CommandRunOptions {
  readonly cwd: string;
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
  readonly env?: Readonly<Record<string, string>>;
}

export interface CommandResult {
  readonly command: string;
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly durationMs: number;
  readonly timedOut: boolean;
  readonly notFound: boolean;
}

export interface CommandExecutor {
  run(
    binary: string,
    args: readonly string[],
    options: CommandRunOptions
  ): Promise<CommandResult>;
}

export interface StationContext {
  readonly repoPath: string;
  readonly stack: RepoStack;
  readonly minCoverage: number;
  readonly commandTimeoutMs: number;
  readonly executor: CommandExecutor;
  readonly signal?: AbortSignal;
}

export interface StationRunner {
  readonly metadata: StationMetadata;
  run(context: StationContext): Promise<StationResult>;
}
