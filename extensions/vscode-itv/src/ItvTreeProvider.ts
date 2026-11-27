import * as vscode from 'vscode';
import type { Finding, StationMetadata, StationResult, StationStatus } from '../../../src/domain/types.js';
import { STATION_CATALOG } from '../../../src/domain/catalog.js';
import { getUiStrings, localizedStationName, type UiStrings } from './i18n.js';

const ORDERED_STATIONS: readonly StationMetadata[] = Object.values(STATION_CATALOG).sort(
  (a, b) => a.order - b.order
);

export type StationRuntimeState = 'idle' | 'running' | StationStatus;

export interface StationViewNode {
  kind: 'station';
  meta: StationMetadata;
  state: StationRuntimeState;
  result?: StationResult;
}

export interface FindingViewNode {
  kind: 'finding';
  repoPath: string;
  finding: Finding;
}

export interface InfoViewNode {
  kind: 'info';
  label: string;
  description?: string;
}

export type ItvTreeNode = StationViewNode | FindingViewNode | InfoViewNode;

function iconForState(state: StationRuntimeState): vscode.ThemeIcon {
  switch (state) {
    case 'pass':
      return new vscode.ThemeIcon('pass-filled', new vscode.ThemeColor('testing.iconPassed'));
    case 'warn':
      return new vscode.ThemeIcon('warning', new vscode.ThemeColor('editorWarning.foreground'));
    case 'fail':
      return new vscode.ThemeIcon('error', new vscode.ThemeColor('testing.iconFailed'));
    case 'skipped':
      return new vscode.ThemeIcon('circle-slash', new vscode.ThemeColor('disabledForeground'));
    case 'running':
      return new vscode.ThemeIcon('sync~spin', new vscode.ThemeColor('charts.blue'));
    default:
      return new vscode.ThemeIcon('circle-outline');
  }
}

export class ItvTreeProvider implements vscode.TreeDataProvider<ItvTreeNode> {
  private readonly emitter = new vscode.EventEmitter<ItvTreeNode | undefined | void>();
  readonly onDidChangeTreeData = this.emitter.event;

  private repoPath = '';
  private readonly states = new Map<string, StationRuntimeState>();
  private readonly results = new Map<string, StationResult>();

  constructor(private readonly strings: UiStrings = getUiStrings()) {
    this.reset('');
  }

  reset(repoPath: string): void {
    this.repoPath = repoPath;
    this.states.clear();
    this.results.clear();
    for (const meta of ORDERED_STATIONS) {
      this.states.set(meta.id, 'idle');
    }
    this.emitter.fire();
  }

  markStationRunning(stationId: string): void {
    this.states.set(stationId, 'running');
    this.emitter.fire();
  }

  markStationComplete(result: StationResult): void {
    this.states.set(result.id, result.status);
    this.results.set(result.id, result);
    this.emitter.fire();
  }

  getTreeItem(element: ItvTreeNode): vscode.TreeItem {
    if (element.kind === 'station') {
      const hasChildren = Boolean(element.result);
      const collapsible = hasChildren
        ? element.state === 'fail' || element.state === 'warn'
          ? vscode.TreeItemCollapsibleState.Expanded
          : vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None;

      const stationLabel = localizedStationName(
        element.meta.id,
        element.result?.shortName ?? element.meta.shortName,
        this.strings
      );
      const title = `${String(element.meta.order).padStart(2, '0')} · ${stationLabel}`;
      const item = new vscode.TreeItem(title, collapsible);
      const timeTxt = element.result ? ` · ${(element.result.durationMs / 1000).toFixed(1)}s` : '';
      item.description = `${this.strings.stateLabels[element.state]}${timeTxt}`;
      item.tooltip = element.result?.summary ?? element.meta.didactic.whatItChecks;
      item.iconPath = iconForState(element.state);
      return item;
    }

    if (element.kind === 'finding') {
      const loc = element.finding.file
        ? `${element.finding.file}${element.finding.line ? `:${element.finding.line}` : ''}`
        : '';
      const item = new vscode.TreeItem(element.finding.title, vscode.TreeItemCollapsibleState.None);
      item.description = loc;
      item.tooltip = `${element.finding.reason}\n\n${this.strings.howToFixLabel}: ${element.finding.howToFix}`;
      item.iconPath =
        element.finding.severity === 'error'
          ? new vscode.ThemeIcon('error', new vscode.ThemeColor('testing.iconFailed'))
          : new vscode.ThemeIcon('warning', new vscode.ThemeColor('editorWarning.foreground'));
      if (element.finding.file) {
        item.command = {
          title: this.strings.openFindingTitle,
          command: 'itvCalidad.openFinding',
          arguments: [element.repoPath, element.finding.file, element.finding.line ?? 1]
        };
      }
      return item;
    }

    const infoItem = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
    if (element.description) {
      infoItem.description = element.description;
    }
    infoItem.iconPath = new vscode.ThemeIcon('info');
    return infoItem;
  }

  getChildren(element?: ItvTreeNode): ItvTreeNode[] {
    if (!element) {
      return ORDERED_STATIONS.map((meta) => {
        const result = this.results.get(meta.id);
        return {
          kind: 'station' as const,
          meta,
          state: this.states.get(meta.id) ?? 'idle',
          ...(result ? { result } : {})
        };
      });
    }

    if (element.kind !== 'station' || !element.result) {
      return [];
    }

    const children: ItvTreeNode[] = [
      { kind: 'info', label: element.result.summary }
    ];

    for (const finding of element.result.findings) {
      children.push({
        kind: 'finding',
        repoPath: this.repoPath,
        finding
      });
    }

    return children;
  }
}
