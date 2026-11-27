import path from 'node:path';
import * as vscode from 'vscode';
import { exportReportAsMarkdown } from '../../../src/application/ExportReportMarkdown.js';
import { RunItvInspection } from '../../../src/application/RunItvInspection.js';
import type { InspectionReport } from '../../../src/domain/types.js';
import { loadLocalEnv } from '../../../src/infrastructure/config/loadDotEnv.js';
import { SafeCommandExecutor } from '../../../src/infrastructure/exec/SafeCommandExecutor.js';
import { createDefaultStations } from '../../../src/infrastructure/stations/index.js';
import { IntegrationsStore } from './IntegrationsStore.js';
import { getUiStrings, localizedStationName } from './i18n.js';
import { ItvTreeProvider } from './ItvTreeProvider.js';
import { ItvWebviewProvider } from './ItvWebviewProvider.js';

let activeController: AbortController | null = null;
let lastReport: InspectionReport | null = null;

async function resolveTargetFolder(openLabel: string): Promise<string | null> {
  const firstWorkspace = vscode.workspace.workspaceFolders?.[0];
  if (firstWorkspace) {
    return firstWorkspace.uri.fsPath;
  }

  const picked = await vscode.window.showOpenDialog({
    canSelectFolders: true,
    canSelectFiles: false,
    canSelectMany: false,
    openLabel
  });

  return picked?.[0]?.fsPath ?? null;
}

export function activate(context: vscode.ExtensionContext): void {
  const strings = getUiStrings();
  const integrationsStore = new IntegrationsStore(context);
  const treeProvider = new ItvTreeProvider(strings);
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBar.text = '$(shield) ITV';
  statusBar.tooltip = strings.statusBarTooltip;
  statusBar.command = 'itvCalidad.runInspection';
  statusBar.show();

  const runInspection = async (): Promise<void> => {
    if (activeController) {
      void vscode.window.showWarningMessage(strings.alreadyRunningWarn);
      return;
    }

    const repoPath = await resolveTargetFolder(strings.openFolderLabel);
    if (!repoPath) return;

    loadLocalEnv(repoPath);
    await integrationsStore.applyToProcessEnv();
    const controller = new AbortController();
    activeController = controller;
    treeProvider.reset(repoPath);

    statusBar.text = strings.statusBarScanning;
    statusBar.backgroundColor = undefined;

    const runner = new RunItvInspection(createDefaultStations(), new SafeCommandExecutor());

    try {
      const report = await runner.execute(
        {
          repoPath,
          slowMotionMs: 250,
          minCoverage: 75,
          signal: controller.signal
        },
        (event) => {
          if (event.type === 'inspection:start') {
            webviewProvider.postStart(event.stack.repoName, event.stack.primaryStack);
          } else if (event.type === 'station:start') {
            treeProvider.markStationRunning(event.station.id);
            webviewProvider.postStationRunning(
              event.station.id,
              localizedStationName(event.station.id, event.station.shortName, strings)
            );
          } else if (event.type === 'station:complete') {
            treeProvider.markStationComplete(event.result);
            webviewProvider.postStationComplete(event.result);
          }
        }
      );

      lastReport = report;
      webviewProvider.postComplete(report);

      if (report.blocksPush) {
        statusBar.text = `$(error) ITV: ${strings.statusBarFail} (${report.summary.failed})`;
        statusBar.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
      } else if (report.verdict === 'APTO') {
        statusBar.text = `$(pass-filled) ITV: ${report.summary.passed}/${report.summary.total} ${strings.statusBarPass}`;
        statusBar.backgroundColor = undefined;
      } else {
        statusBar.text = `$(warning) ITV: ${report.summary.warned} ${strings.statusBarWarn}`;
        statusBar.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : strings.defaultError;
      webviewProvider.postError(message);
      statusBar.text = '$(shield) ITV';
      if (!controller.signal.aborted) {
        void vscode.window.showErrorMessage(`${strings.appTitle}: ${message}`);
      }
    } finally {
      activeController = null;
    }
  };

  const stopInspection = (): void => {
    if (activeController) {
      activeController.abort();
      activeController = null;
      statusBar.text = strings.statusBarStopped;
    }
  };

  const exportMarkdown = async (): Promise<void> => {
    if (!lastReport) {
      void vscode.window.showInformationMessage(strings.runFirstToExportInfo);
      return;
    }
    const md = exportReportAsMarkdown(lastReport);
    const doc = await vscode.workspace.openTextDocument({ content: md, language: 'markdown' });
    await vscode.window.showTextDocument(doc);
  };

  const openFinding = async (repoPath: unknown, relativeFile: unknown, line: unknown): Promise<void> => {
    if (typeof repoPath !== 'string' || typeof relativeFile !== 'string') return;
    const absolutePath = path.isAbsolute(relativeFile) ? relativeFile : path.join(repoPath, relativeFile);
    const lineIdx = Math.max(0, (typeof line === 'number' ? line : 1) - 1);
    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(absolutePath));
    const pos = new vscode.Position(lineIdx, 0);
    await vscode.window.showTextDocument(doc, { selection: new vscode.Range(pos, pos) });
  };

  const webviewProvider = new ItvWebviewProvider(
    {
      onRun: () => {
        void runInspection();
      },
      onStop: stopInspection,
      onExport: () => {
        void exportMarkdown();
      },
      onRequestIntegrations: () => {
        void integrationsStore.getPublicStatus().then((st) => webviewProvider.postIntegrationsStatus(st));
      },
      onSaveIntegrations: (update) => {
        void integrationsStore.save(update).then((st) => {
          webviewProvider.postIntegrationsStatus(st, true);
          void vscode.window.showInformationMessage(
            `${strings.integrationsSavedPrefix}${st.activeCount}${strings.integrationsActiveSuffix}`
          );
        });
      }
    },
    strings
  );

  context.subscriptions.push(
    statusBar,
    vscode.window.registerTreeDataProvider('itvStationsView', treeProvider),
    vscode.window.registerWebviewViewProvider('itvCockpitView', webviewProvider, {
      webviewOptions: { retainContextWhenHidden: true }
    }),
    vscode.commands.registerCommand('itvCalidad.runInspection', runInspection),
    vscode.commands.registerCommand('itvCalidad.stopInspection', stopInspection),
    vscode.commands.registerCommand('itvCalidad.exportMarkdown', exportMarkdown),
    vscode.commands.registerCommand('itvCalidad.openFinding', openFinding),
    vscode.commands.registerCommand('itvCalidad.configureIntegrations', () => {
      webviewProvider.openIntegrationsPanel();
    })
  );
}

export function deactivate(): void {
  if (activeController) {
    activeController.abort();
    activeController = null;
  }
}
