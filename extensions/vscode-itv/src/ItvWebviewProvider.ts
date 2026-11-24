import { randomBytes } from 'node:crypto';
import * as vscode from 'vscode';
import type { InspectionReport, StationResult } from '../../../src/domain/types.js';
import { STATION_CATALOG } from '../../../src/domain/catalog.js';
import type { ExtensionIntegrationsStatus, ExtensionIntegrationsUpdate } from './IntegrationsStore.js';

export interface CockpitCallbacks {
  onRun: () => void;
  onStop: () => void;
  onExport: () => void;
  onRequestIntegrations: () => void;
  onSaveIntegrations: (update: ExtensionIntegrationsUpdate) => void;
}

export class ItvWebviewProvider implements vscode.WebviewViewProvider {
  private view: vscode.WebviewView | undefined;
  private lastPayload: unknown = null;

  constructor(private readonly callbacks: CockpitCallbacks) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this.buildHtml();

    webviewView.webview.onDidReceiveMessage((raw) => {
      const msg = raw as { type?: string; payload?: ExtensionIntegrationsUpdate } | null;
      if (msg?.type === 'run') this.callbacks.onRun();
      else if (msg?.type === 'stop') this.callbacks.onStop();
      else if (msg?.type === 'export') this.callbacks.onExport();
      else if (msg?.type === 'getIntegrations') this.callbacks.onRequestIntegrations();
      else if (msg?.type === 'saveIntegrations' && msg.payload) {
        this.callbacks.onSaveIntegrations(msg.payload);
      }
    });

    this.callbacks.onRequestIntegrations();
    if (this.lastPayload) {
      void webviewView.webview.postMessage(this.lastPayload);
    }
  }

  openIntegrationsPanel(): void {
    if (this.view) {
      this.view.show?.(false);
      void this.view.webview.postMessage({ type: 'openIntegrations' });
    }
  }

  postIntegrationsStatus(status: ExtensionIntegrationsStatus, saved = false): void {
    if (this.view) {
      void this.view.webview.postMessage({ type: 'integrations', status, saved });
    }
  }

  postStart(repoName: string, stack: string): void {
    this.emit({ type: 'start', repoName, stack });
  }

  postStationRunning(stationId: string, name: string): void {
    this.emit({ type: 'station:running', stationId, name });
  }

  postStationComplete(result: StationResult): void {
    this.emit({
      type: 'station:complete',
      stationId: result.id,
      shortName: result.shortName,
      status: result.status,
      durationMs: result.durationMs
    });
  }

  postComplete(report: InspectionReport): void {
    this.emit({
      type: 'complete',
      verdict: report.verdict,
      blocksPush: report.blocksPush,
      durationSec: (report.totalDurationMs / 1000).toFixed(1),
      summary: report.summary,
      scope: report.scope ?? null,
      checklistScore: report.securityChecklist?.scorePercent ?? null
    });
  }

  postError(message: string): void {
    this.emit({ type: 'error', message });
  }

  private emit(payload: unknown): void {
    this.lastPayload = payload;
    if (this.view) {
      void this.view.webview.postMessage(payload);
    }
  }

  private buildHtml(): string {
    const nonce = randomBytes(16).toString('hex');
    const stationsJson = JSON.stringify(
      Object.values(STATION_CATALOG)
        .sort((a, b) => a.order - b.order)
        .map((s) => ({ id: s.id, order: s.order, shortName: s.shortName }))
    );

    return `<!doctype html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';" />
  <title>ITV de Código</title>
  <style nonce="${nonce}">
    :root { --bg:#0b0f17; --card:#121826; --border:#1e293b; --text:#f1f5f9; --muted:#94a3b8; --green:#22c55e; --amber:#f59e0b; --red:#ef4444; --blue:#38bdf8; }
    * { box-sizing: border-box; }
    body { margin:0; padding:10px; background:var(--bg); color:var(--text); font-family:var(--vscode-font-family,system-ui,sans-serif); font-size:12px; }
    .head { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:10px; }
    .brand { display:flex; align-items:center; gap:8px; }
    .logo { width:28px; height:28px; border-radius:7px; background:linear-gradient(135deg,#38bdf8,#2563eb); display:grid; place-items:center; font-weight:800; font-size:11px; color:#fff; }
    .title { font-weight:700; font-size:13px; margin:0; }
    .sub { color:var(--muted); font-size:11px; margin:0; }
    .traffic { display:flex; gap:5px; background:#070a10; border:1px solid var(--border); padding:4px 7px; border-radius:999px; }
    .lamp { width:9px; height:9px; border-radius:50%; opacity:0.22; }
    .lamp--red { background:var(--red); } .lamp--amber { background:var(--amber); } .lamp--green { background:var(--green); }
    .lamp.on { opacity:1; box-shadow:0 0 8px currentColor; }
    .actions { display:flex; gap:6px; margin-bottom:6px; }
    button { flex:1; border:1px solid var(--border); border-radius:6px; padding:6px 8px; font-weight:600; font-size:11px; cursor:pointer; color:var(--text); background:#1e293b; }
    button.primary { background:linear-gradient(135deg,#38bdf8,#2563eb); border-color:transparent; color:#fff; }
    button.danger { background:#7f1d1d; border-color:#ef4444; color:#fee2e2; }
    button.full { width:100%; margin-bottom:8px; }
    button:disabled { opacity:0.5; cursor:not-allowed; }
    .card { background:var(--card); border:1px solid var(--border); border-radius:8px; padding:9px; margin-bottom:8px; }
    .status { color:var(--muted); font-size:11px; margin-bottom:7px; }
    .track { display:grid; grid-template-columns:repeat(7,1fr); gap:4px; }
    .dot { height:22px; border-radius:5px; border:1px solid var(--border); background:#0f172a; display:grid; place-items:center; font-size:10px; font-weight:700; color:var(--muted); }
    .dot.running { border-color:var(--blue); color:var(--blue); animation:pulse 1s infinite; }
    .dot.pass { border-color:var(--green); background:rgba(34,197,94,0.16); color:var(--green); }
    .dot.warn { border-color:var(--amber); background:rgba(245,158,11,0.16); color:var(--amber); }
    .dot.fail { border-color:var(--red); background:rgba(239,68,68,0.18); color:var(--red); }
    .dot.skipped { opacity:0.45; }
    @keyframes pulse { 0%,100%{opacity:1;} 50%{opacity:0.45;} }
    .verdict { font-weight:700; font-size:13px; margin-bottom:4px; }
    .verdict.pass { color:var(--green); } .verdict.warn { color:var(--amber); } .verdict.fail { color:var(--red); }
    .kpis { display:grid; grid-template-columns:repeat(2,1fr); gap:6px; margin-top:6px; }
    .kpi { background:#0b0f17; border:1px solid var(--border); border-radius:6px; padding:6px; }
    .kpi span { display:block; color:var(--muted); font-size:10px; }
    .kpi strong { font-size:13px; }
    .field { margin-bottom:7px; }
    .field label { display:block; color:var(--muted); font-size:10px; margin-bottom:3px; }
    .field input { width:100%; background:#0b0f17; color:var(--text); border:1px solid var(--border); border-radius:5px; padding:5px 7px; font-size:11px; }
    .sec-title { font-weight:700; font-size:11px; color:var(--blue); margin:8px 0 4px; display:flex; justify-content:space-between; }
    .pill-ok { color:var(--green); font-size:10px; }
    .save-msg { color:var(--green); font-size:11px; margin-top:6px; }
    [hidden] { display:none !important; }
  </style>
</head>
<body>
  <div class="head">
    <div class="brand">
      <div class="logo" aria-hidden="true">ITV</div>
      <div>
        <p class="title">ITV de Código</p>
        <p class="sub" id="repo-label">7 estaciones · 100% local</p>
      </div>
    </div>
    <div class="traffic" role="status" aria-label="Semáforo ITV">
      <span id="l-red" class="lamp lamp--red"></span>
      <span id="l-amber" class="lamp lamp--amber"></span>
      <span id="l-green" class="lamp lamp--green"></span>
    </div>
  </div>

  <div class="actions">
    <button id="btn-run" class="primary" type="button">Pasar ITV</button>
    <button id="btn-stop" class="danger" type="button" hidden>Detener</button>
    <button id="btn-export" type="button" disabled>Exportar .md</button>
  </div>
  <button id="btn-integrations" class="full" type="button">⚙ Integraciones (0)</button>

  <form id="int-panel" class="card" hidden>
    <p class="sub">Tokens guardados en el almacén cifrado de tu sistema operativo (SecretStorage). Opcional.</p>
    <div class="sec-title"><span>Sentry</span><span id="st-sentry" class="pill-ok"></span></div>
    <div class="field"><label for="i-sentry-token">SENTRY_AUTH_TOKEN</label><input id="i-sentry-token" type="password" placeholder="sntryu_..." autocomplete="off" /></div>
    <div class="field"><label for="i-sentry-org">SENTRY_ORG</label><input id="i-sentry-org" type="text" placeholder="mi-organizacion" /></div>
    <div class="field"><label for="i-sentry-proj">SENTRY_PROJECT</label><input id="i-sentry-proj" type="text" placeholder="mi-proyecto" /></div>

    <div class="sec-title"><span>GitHub Security</span><span id="st-github" class="pill-ok"></span></div>
    <div class="field"><label for="i-gh-token">GITHUB_TOKEN (opcional)</label><input id="i-gh-token" type="password" placeholder="ghp_... o github_pat_..." autocomplete="off" /></div>

    <div class="sec-title"><span>SonarCloud / SonarQube</span><span id="st-sonar" class="pill-ok"></span></div>
    <div class="field"><label for="i-sonar-token">SONAR_TOKEN</label><input id="i-sonar-token" type="password" placeholder="squ_..." autocomplete="off" /></div>
    <div class="field"><label for="i-sonar-host">SONAR_HOST_URL</label><input id="i-sonar-host" type="text" placeholder="https://sonarcloud.io" /></div>
    <div class="field"><label for="i-sonar-key">SONAR_PROJECT_KEY</label><input id="i-sonar-key" type="text" placeholder="org_proyecto" /></div>

    <div class="actions">
      <button type="submit" class="primary">Guardar cifrado</button>
      <button type="button" id="btn-int-close">Cerrar</button>
    </div>
    <div id="int-msg" class="save-msg" hidden>Guardado en el llavero cifrado del IDE.</div>
  </form>

  <div class="card">
    <div id="status" class="status">Lista para inspeccionar el workspace abierto.</div>
    <div id="track" class="track"></div>
  </div>

  <div id="verdict-card" class="card" hidden>
    <div id="verdict-text" class="verdict"></div>
    <div id="verdict-sub" class="sub"></div>
    <div id="kpis" class="kpis"></div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const stations = ${stationsJson};
    const $ = (id) => document.getElementById(id);
    let stateMap = {};

    function renderTrack() {
      $('track').innerHTML = stations.map(s => '<div class="dot ' + (stateMap[s.id] || 'idle') + '" title="' + s.shortName + '">0' + s.order + '</div>').join('');
    }
    function setLamp(color) {
      ['red', 'amber', 'green'].forEach(c => $('l-' + c).classList.toggle('on', c === color));
    }
    renderTrack();

    $('btn-run').addEventListener('click', () => vscode.postMessage({ type: 'run' }));
    $('btn-stop').addEventListener('click', () => vscode.postMessage({ type: 'stop' }));
    $('btn-export').addEventListener('click', () => vscode.postMessage({ type: 'export' }));
    $('btn-integrations').addEventListener('click', () => {
      $('int-panel').hidden = !$('int-panel').hidden;
      if (!$('int-panel').hidden) vscode.postMessage({ type: 'getIntegrations' });
    });
    $('btn-int-close').addEventListener('click', () => { $('int-panel').hidden = true; });
    $('int-panel').addEventListener('submit', (e) => {
      e.preventDefault();
      $('int-msg').hidden = true;
      vscode.postMessage({
        type: 'saveIntegrations',
        payload: {
          sentryAuthToken: $('i-sentry-token').value,
          sentryOrg: $('i-sentry-org').value,
          sentryProject: $('i-sentry-proj').value,
          githubToken: $('i-gh-token').value,
          sonarToken: $('i-sonar-token').value,
          sonarHostUrl: $('i-sonar-host').value,
          sonarProjectKey: $('i-sonar-key').value
        }
      });
      $('i-sentry-token').value = '';
      $('i-gh-token').value = '';
      $('i-sonar-token').value = '';
    });

    window.addEventListener('message', (event) => {
      const msg = event.data || {};
      if (msg.type === 'openIntegrations') {
        $('int-panel').hidden = false;
        vscode.postMessage({ type: 'getIntegrations' });
      } else if (msg.type === 'integrations' && msg.status) {
        const st = msg.status;
        $('btn-integrations').textContent = '⚙ Integraciones (' + st.activeCount + ')';
        $('st-sentry').textContent = st.sentryConfigured ? 'Conectado' : '';
        $('st-github').textContent = st.githubConfigured ? 'Conectado' : '';
        $('st-sonar').textContent = st.sonarConfigured ? 'Conectado' : '';
        $('i-sentry-org').value = st.sentryOrg || '';
        $('i-sentry-proj').value = st.sentryProject || '';
        $('i-sonar-host').value = st.sonarHostUrl || 'https://sonarcloud.io';
        $('i-sonar-key').value = st.sonarProjectKey || '';
        $('int-msg').hidden = !msg.saved;
      } else if (msg.type === 'start') {
        stateMap = {}; renderTrack();
        $('verdict-card').hidden = true;
        $('btn-run').hidden = true; $('btn-stop').hidden = false; $('btn-export').disabled = true;
        $('repo-label').textContent = msg.repoName + ' · ' + msg.stack;
        $('status').textContent = 'Iniciando inspección de 7 estaciones…';
        setLamp('amber');
      } else if (msg.type === 'station:running') {
        stateMap[msg.stationId] = 'running'; renderTrack();
        $('status').textContent = 'Ejecutando ' + msg.name + '…';
      } else if (msg.type === 'station:complete') {
        stateMap[msg.stationId] = msg.status; renderTrack();
      } else if (msg.type === 'complete') {
        $('btn-run').hidden = false; $('btn-stop').hidden = true; $('btn-export').disabled = false;
        const cls = msg.blocksPush ? 'fail' : (msg.verdict === 'APTO' ? 'pass' : 'warn');
        setLamp(cls === 'pass' ? 'green' : cls === 'warn' ? 'amber' : 'red');
        $('status').textContent = 'Completada en ' + msg.durationSec + 's.';
        $('verdict-card').hidden = false;
        $('verdict-text').className = 'verdict ' + cls;
        $('verdict-text').textContent = msg.verdict.replace(/_/g, ' ');
        $('verdict-sub').textContent = msg.blocksPush
          ? 'Hay fallos bloqueantes antes de hacer git push.'
          : (msg.scope ? msg.scope.label + ' (' + msg.scope.confidencePercent + '%) · ' + msg.scope.note : 'Sin fallos bloqueantes. Revisa los detalles abajo.');
        const s = msg.summary;
        const scopeVal = msg.scope ? msg.scope.evaluatedStations + '/' + msg.scope.totalStations + ' (' + msg.scope.confidencePercent + '%)' : s.passed + '/' + s.total;
        $('kpis').innerHTML =
          '<div class="kpi"><span>Aptas</span><strong>' + s.passed + '/' + s.total + '</strong></div>' +
          '<div class="kpi"><span>Alcance verificado</span><strong>' + scopeVal + '</strong></div>' +
          '<div class="kpi"><span>Checklist OWASP</span><strong>' + (msg.checklistScore !== null ? msg.checklistScore + '%' : 'N/A') + '</strong></div>' +
          '<div class="kpi"><span>Tiempo</span><strong>' + msg.durationSec + 's</strong></div>';
      } else if (msg.type === 'error') {
        $('btn-run').hidden = false; $('btn-stop').hidden = true; setLamp('red');
        $('status').textContent = 'Error: ' + msg.message;
      }
    });
  </script>
</body>
</html>`;
  }
}
