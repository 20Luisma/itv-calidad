import {
  App,
  applyDocumentTheme,
  applyHostStyleVariables
} from '@modelcontextprotocol/ext-apps';
import {
  buildChecklistHtml,
  buildIdleTrackHtml,
  buildStationsHtml,
  buildTrackHtml,
  DEFAULT_TRACK,
  type ReportPayload
} from './render.js';

const pillRepo = document.getElementById('pill-repo')!;
const pillStack = document.getElementById('pill-stack')!;
const trafficEl = document.getElementById('traffic')!;
const launcherForm = document.getElementById('launcher-form') as HTMLFormElement;
const repoInput = document.getElementById('repo-input') as HTMLInputElement;
const runBtn = document.getElementById('btn-run') as HTMLButtonElement;
const errorBox = document.getElementById('error-box')!;
const statusLine = document.getElementById('status-line')!;
const trackEl = document.getElementById('track')!;
const verdictPanel = document.getElementById('verdict-panel')!;
const verdictBadge = document.getElementById('verdict-badge')!;
const verdictTitle = document.getElementById('verdict-title')!;
const verdictSub = document.getElementById('verdict-sub')!;
const kpisEl = document.getElementById('kpis')!;
const detailsPanel = document.getElementById('details-panel')!;
const detailsList = document.getElementById('details-list')!;
const fixAllBtn = document.getElementById('btn-fix-all') as HTMLButtonElement;
const checklistPanel = document.getElementById('checklist-panel')!;
const checklistScore = document.getElementById('checklist-score')!;
const checklistBar = document.getElementById('checklist-bar') as HTMLProgressElement;
const checklistGrid = document.getElementById('checklist-grid')!;

let scanTimer: ReturnType<typeof setInterval> | null = null;
let currentReport: ReportPayload | null = null;
let canSendMessage = false;
let canOpenLinks = false;

const VERDICT_META = {
  fail: {
    badge: 'DESFAVORABLE · BLOQUEA PUSH',
    title: 'Fallos bloqueantes detectados'
  },
  warn: {
    badge: 'APTO CON OBSERVACIONES',
    title: 'Apto con mejoras recomendadas'
  },
  pass: {
    badge: 'APTO PARA GIT PUSH',
    title: 'Inspección superada en verde'
  }
} as const;

function setTraffic(mode: '' | 'running' | 'pass' | 'warn' | 'fail'): void {
  trafficEl.className = mode ? `traffic traffic--${mode}` : 'traffic';
}

function showError(msg: string): void {
  errorBox.textContent = msg;
  errorBox.hidden = false;
}

function clearError(): void {
  errorBox.textContent = '';
  errorBox.hidden = true;
}

function stopScanAnimation(): void {
  if (scanTimer) {
    clearInterval(scanTimer);
    scanTimer = null;
  }
}

function resetButton(label: string): void {
  stopScanAnimation();
  runBtn.disabled = false;
  runBtn.textContent = label;
}

function startScanningState(repoPath?: string): void {
  clearError();
  stopScanAnimation();
  runBtn.disabled = true;
  runBtn.textContent = 'Escaneando…';
  setTraffic('running');
  verdictPanel.hidden = true;
  detailsPanel.hidden = true;
  checklistPanel.hidden = true;

  if (repoPath) {
    repoInput.value = repoPath;
    pillRepo.textContent = `Repo: ${repoPath.split(/[\\/]/).filter(Boolean).pop() ?? repoPath}`;
  }

  let step = 0;
  statusLine.textContent = 'Inspeccionando Estación 1/7…';
  trackEl.innerHTML = buildIdleTrackHtml(step);

  scanTimer = setInterval(() => {
    step = (step + 1) % DEFAULT_TRACK.length;
    statusLine.textContent = `Escaneando ${DEFAULT_TRACK[step]?.shortName ?? ''} (${step + 1}/7)…`;
    trackEl.innerHTML = buildIdleTrackHtml(step);
  }, 650);
}

function bindStationInteractions(data: ReportPayload): void {
  trackEl.querySelectorAll<HTMLButtonElement>('[data-jump]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.dataset.jump ?? '');
      if (target) {
        (target as HTMLDetailsElement).open = true;
        target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  });

  detailsList.querySelectorAll<HTMLButtonElement>('[data-open-url]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.openUrl && canOpenLinks) {
        void app.openLink({ url: btn.dataset.openUrl });
      }
    });
  });

  detailsList.querySelectorAll<HTMLButtonElement>('[data-fix-st]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const st = data.stations?.find((item) => item.order === Number(btn.dataset.fixSt));
      const finding = st?.findings[Number(btn.dataset.fixIdx)];
      if (!finding || !canSendMessage) return;
      const loc = finding.file ? ` en \`${finding.file}${finding.line ? `:${finding.line}` : ''}\`` : '';
      await app.sendMessage({
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Arreglá este hallazgo detectado por la ITV de Código (${data.repoPath ?? ''}):\n- **${finding.title}**${loc}\n- Motivo: ${finding.reason}\n- Guía: ${finding.howToFix}`
          }
        ]
      });
    });
  });
}

function renderReport(data: ReportPayload): void {
  resetButton('Re-escanear');
  clearError();
  currentReport = data;

  if (data.mode === 'idle' || !data.stations) {
    setTraffic('');
    if (data.defaultRepoPath && !repoInput.value) repoInput.value = data.defaultRepoPath;
    statusLine.textContent = 'Indicá un repositorio y apretá "Pasar ITV"';
    trackEl.innerHTML = buildIdleTrackHtml(-1);
    return;
  }

  if (data.repoPath) repoInput.value = data.repoPath;
  pillRepo.textContent = `Repo: ${data.repoName ?? 'local'}`;
  pillStack.textContent = `Stack: ${data.primaryStack ?? '—'}${data.gitBranch ? ` · ${data.gitBranch}` : ''}`;

  const vMode =
    data.verdict === 'DESFAVORABLE'
      ? 'fail'
      : data.verdict === 'APTO_CON_OBSERVACIONES'
        ? 'warn'
        : 'pass';

  setTraffic(vMode);
  statusLine.textContent = `Completada · ${data.verdict ?? 'APTO'}`;
  verdictPanel.hidden = false;
  verdictPanel.className = `panel verdict verdict--${vMode}`;
  verdictBadge.className = `badge badge--${vMode}`;
  verdictBadge.textContent = VERDICT_META[vMode].badge;
  verdictTitle.textContent = VERDICT_META[vMode].title;
  verdictSub.textContent = `${data.repoName ?? ''} · ${((data.totalDurationMs ?? 0) / 1000).toFixed(2)}s`;

  const s = data.summary ?? { passed: 0, warned: 0, failed: 0, skipped: 0 };
  kpisEl.innerHTML = `<div class="kpi"><span class="kpi__v" style="color:var(--pass)">${s.passed}</span><span class="kpi__l">Aptas</span></div><div class="kpi"><span class="kpi__v" style="color:var(--warn)">${s.warned}</span><span class="kpi__l">Obs.</span></div><div class="kpi"><span class="kpi__v" style="color:var(--fail)">${s.failed}</span><span class="kpi__l">Fallos</span></div><div class="kpi"><span class="kpi__v">${s.skipped}</span><span class="kpi__l">Omit.</span></div>`;

  trackEl.innerHTML = buildTrackHtml(data.stations);
  detailsPanel.hidden = false;
  detailsList.innerHTML = buildStationsHtml(data.stations, canSendMessage);
  const hasActionable = data.stations.some((st) =>
    st.findings.some((f) => f.severity === 'error' || f.severity === 'warning')
  );
  fixAllBtn.hidden = !(canSendMessage && hasActionable);
  bindStationInteractions(data);

  if (data.securityChecklist) {
    const cl = data.securityChecklist;
    checklistPanel.hidden = false;
    checklistScore.textContent = `${cl.scorePercent}% (${cl.automatedPassed}/${cl.automatedTotal} automáticos)`;
    checklistBar.value = cl.scorePercent;
    checklistGrid.innerHTML = buildChecklistHtml(cl.items);
  }
}

const app = new App({ name: 'ITV de Código', version: '1.1.0' }, {});

app.ontoolinput = ({ arguments: args }) => {
  if (typeof args?.repoPath === 'string' && args.repoPath.trim()) {
    startScanningState(args.repoPath);
  }
};

app.ontoolresult = (result) => {
  if (result.isError) {
    resetButton('Pasar ITV');
    setTraffic('fail');
    const firstText = result.content.find((c) => c.type === 'text');
    showError(firstText && 'text' in firstText ? firstText.text : 'Error ejecutando la ITV.');
    return;
  }
  const structured = result.structuredContent as ReportPayload | undefined;
  if (structured) renderReport(structured);
};

app.ontoolcancelled = () => {
  resetButton('Pasar ITV');
  setTraffic('');
  statusLine.textContent = 'Inspección cancelada.';
};

app.onhostcontextchanged = (ctx) => {
  if (ctx.theme) applyDocumentTheme(ctx.theme);
  if (ctx.styles?.variables) applyHostStyleVariables(ctx.styles.variables);
};

launcherForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const repoPath = repoInput.value.trim();
  if (!repoPath) {
    showError('Ingresá la ruta absoluta de un repositorio local.');
    return;
  }
  startScanningState(repoPath);
  try {
    const result = await app.callServerTool({ name: 'run_itv', arguments: { repoPath } });
    if (result.isError) {
      resetButton('Pasar ITV');
      setTraffic('fail');
      const firstText = result.content.find((c) => c.type === 'text');
      showError(firstText && 'text' in firstText ? firstText.text : 'Error ejecutando la ITV.');
      return;
    }
    const structured = result.structuredContent as ReportPayload | undefined;
    if (structured) renderReport(structured);
  } catch (err) {
    resetButton('Pasar ITV');
    setTraffic('fail');
    showError(err instanceof Error ? err.message : 'Error invocando run_itv.');
  }
});

fixAllBtn.addEventListener('click', async () => {
  if (!currentReport?.stations || !canSendMessage) return;
  const lines = currentReport.stations
    .flatMap((st) =>
      st.findings
        .filter((f) => f.severity === 'error' || f.severity === 'warning')
        .map(
          (f) =>
            `- [${f.severity.toUpperCase()}] ${f.title}${f.file ? ` (${f.file}${f.line ? `:${f.line}` : ''})` : ''}: ${f.howToFix}`
        )
    )
    .slice(0, 15);
  if (lines.length === 0) return;
  await app.sendMessage({
    role: 'user',
    content: [
      {
        type: 'text',
        text: `Corregí estos hallazgos de la ITV de Código sobre \`${currentReport.repoPath ?? ''}\`:\n${lines.join('\n')}`
      }
    ]
  });
});

async function init(): Promise<void> {
  trackEl.innerHTML = buildIdleTrackHtml(-1);
  await app.connect();
  const ctx = app.getHostContext();
  if (ctx?.theme) applyDocumentTheme(ctx.theme);
  if (ctx?.styles?.variables) applyHostStyleVariables(ctx.styles.variables);

  const caps = app.getHostCapabilities() as Record<string, unknown> | undefined;
  canSendMessage = Boolean(caps?.message);
  canOpenLinks = Boolean(caps?.openLinks);
}

void init();
