declare module 'vscode' {
  export interface Disposable {
    dispose(): unknown;
  }

  export interface Event<T> {
    (listener: (e: T) => unknown, thisArgs?: unknown, disposables?: Disposable[]): Disposable;
  }

  export class EventEmitter<T> {
    readonly event: Event<T>;
    fire(data: T): void;
    dispose(): void;
  }

  export class Uri {
    readonly fsPath: string;
    static file(path: string): Uri;
    static parse(value: string): Uri;
  }

  export class Position {
    constructor(line: number, character: number);
  }

  export class Range {
    constructor(start: Position, end: Position);
  }

  export class ThemeColor {
    constructor(id: string);
  }

  export class ThemeIcon {
    constructor(id: string, color?: ThemeColor);
  }

  export enum TreeItemCollapsibleState {
    None = 0,
    Collapsed = 1,
    Expanded = 2
  }

  export interface Command {
    title: string;
    command: string;
    arguments?: unknown[];
  }

  export class TreeItem {
    label?: string;
    description?: string;
    tooltip?: string;
    iconPath?: ThemeIcon;
    collapsibleState?: TreeItemCollapsibleState;
    command?: Command;
    constructor(label: string, collapsibleState?: TreeItemCollapsibleState);
  }

  export interface TreeDataProvider<T> {
    onDidChangeTreeData?: Event<T | undefined | null | void>;
    getTreeItem(element: T): TreeItem | Thenable<TreeItem>;
    getChildren(element?: T): T[] | Thenable<T[]>;
  }

  export interface Webview {
    options: { enableScripts?: boolean };
    html: string;
    cspSource: string;
    postMessage(message: unknown): Thenable<boolean>;
    onDidReceiveMessage: Event<unknown>;
  }

  export interface WebviewView {
    readonly webview: Webview;
    show?(preserveFocus?: boolean): void;
  }

  export interface WebviewViewProvider {
    resolveWebviewView(webviewView: WebviewView): void | Thenable<void>;
  }

  export enum StatusBarAlignment {
    Left = 1,
    Right = 2
  }

  export interface StatusBarItem extends Disposable {
    text: string;
    tooltip?: string;
    command?: string;
    backgroundColor?: ThemeColor | undefined;
    show(): void;
    hide(): void;
  }

  export interface WorkspaceFolder {
    readonly uri: Uri;
    readonly name: string;
  }

  export interface ExtensionContext {
    readonly subscriptions: Disposable[];
    readonly extensionUri: Uri;
  }

  export namespace workspace {
    export const workspaceFolders: readonly WorkspaceFolder[] | undefined;
    export function openTextDocument(options: { content?: string; language?: string } | Uri): Thenable<unknown>;
  }

  export namespace window {
    export function registerTreeDataProvider<T>(viewId: string, treeDataProvider: TreeDataProvider<T>): Disposable;
    export function registerWebviewViewProvider(
      viewId: string,
      provider: WebviewViewProvider,
      options?: { webviewOptions?: { retainContextWhenHidden?: boolean } }
    ): Disposable;
    export function createStatusBarItem(alignment?: StatusBarAlignment, priority?: number): StatusBarItem;
    export function showTextDocument(document: unknown, options?: { selection?: Range }): Thenable<unknown>;
    export function showInformationMessage(message: string): Thenable<string | undefined>;
    export function showWarningMessage(message: string): Thenable<string | undefined>;
    export function showErrorMessage(message: string): Thenable<string | undefined>;
    export function showOpenDialog(options: {
      canSelectFolders?: boolean;
      canSelectFiles?: boolean;
      canSelectMany?: boolean;
      openLabel?: string;
    }): Thenable<Uri[] | undefined>;
  }

  export namespace commands {
    export function registerCommand(command: string, callback: (...args: unknown[]) => unknown): Disposable;
    export function executeCommand(command: string, ...rest: unknown[]): Thenable<unknown>;
  }
}
