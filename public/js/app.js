import {
  renderSecurityChecklist,
  renderStationCards,
  renderTrackNodes
} from './renderers.js';

const form = document.getElementById('inspection-form');
const repoPathInput = document.getElementById('repo-path');
const browseBtn = document.getElementById('btn-browse');
const targetUrlInput = document.getElementById('target-url');
const slowMotionSelect = document.getElementById('slow-motion');
const minCoverageInput = document.getElementById('min-coverage');
const startBtn = document.getElementById('btn-start');
const stopBtn = document.getElementById('btn-stop');
const errorBanner = document.getElementById('error-banner');
const liveStatus = document.getElementById('live-status');
const stackPill = document.getElementById('stack-pill');
const branchPill = document.getElementById('branch-pill');
const trafficLight = document.getElementById('traffic-light');
const trackProgress = document.getElementById('track-progress');
const trackEl = document.getElementById('station-track');
const stationsGridEl = document.getElementById('stations-grid');
const verdictSection = document.getElementById('verdict-section');
const verdictBadge = document.getElementById('verdict-badge');
const verdictTitle = document.getElementById('verdict-title');
const verdictDesc = document.getElementById('verdict-desc');
const verdictMetrics = document.getElementById('verdict-metrics');
const exportMdBtn = document.getElementById('btn-export-md');
const exportJsonBtn = document.getElementById('btn-export-json');
const checklistSection = document.getElementById('checklist-section');

let catalogStations = [];
let activeSource = null;
let lastReport = null;
const stationState = new Map();
const stationResults = new Map();

function setTrafficLight(mode) {
  if (!trafficLight) return;
  trafficLight.className = 'traffic-light';
  if (mode) {
    trafficLight.classList.add(`traffic-light--${mode}`);
  }
}

function showError(message) {
  errorBanner.textContent = message;
  errorBanner.hidden = false;
}

function clearError() {
  errorBanner.textContent = '';
  errorBanner.hidden = true;
}

function setRunningUi(running) {
  startBtn.disabled = running;
  stopBtn.hidden = !running;
}

function renderAll() {
  renderTrackNodes(trackEl, catalogStations, stationState);
  renderStationCards(stationsGridEl, catalogStations, stationResults, stationState);
  if (trackProgress) {
    trackProgress.max = catalogStations.length || 6;
    trackProgress.value = stationResults.size;
  }
}

function resetRunState() {
  stationState.clear();
  stationResults.clear();
  lastReport = null;
  verdictSection.hidden = true;
  verdictSection.className = 'card verdict-panel';
  checklistSection.hidden = true;
  setTrafficLight('running');
  clearError();
  renderAll();
}

function renderVerdict(report) {
  verdictSection.hidden = false;
  verdictSection.className = 'card verdict-panel';
  verdictBadge.className = 'verdict-badge';

  if (report.verdict === 'DESFAVORABLE') {
    verdictSection.classList.add('verdict-panel--fail');
    verdictBadge.classList.add('verdict-badge--fail');
    verdictBadge.textContent = 'DESFAVORABLE · BLOQUEA PUSH';
    verdictTitle.textContent = 'La ITV encontró fallos bloqueantes';
    verdictDesc.textContent =
      'Corregí las estaciones marcadas en rojo y volvé a pasar la ITV antes de hacer git push.';
    setTrafficLight('fail');
  } else if (report.verdict === 'APTO_CON_OBSERVACIONES') {
    verdictSection.classList.add('verdict-panel--warn');
    verdictBadge.classList.add('verdict-badge--warn');
    verdictBadge.textContent = 'APTO CON OBSERVACIONES';
    verdictTitle.textContent = 'Apto para push con mejoras recomendadas';
    verdictDesc.textContent =
      'No hay fallos bloqueantes, pero conviene atender las observaciones en amarillo para blindar el proyecto.';
    setTrafficLight('warn');
  } else {
    verdictSection.classList.add('verdict-panel--pass');
    verdictBadge.classList.add('verdict-badge--pass');
    verdictBadge.textContent = 'APTO PARA GIT PUSH';
    verdictTitle.textContent = 'Inspección superada en verde';
    verdictDesc.textContent =
      'Tu repositorio pasó todas las estaciones aplicables sin bloqueos. Podés exportar la evidencia técnica.';
    setTrafficLight('pass');
  }

  const seconds = (report.totalDurationMs / 1000).toFixed(2);
  verdictMetrics.innerHTML = `
    <div class="kpi-tile">
      <span class="kpi-tile__val kpi-tile__val--pass">${report.summary.passed}</span>
      <span class="kpi-tile__label">Aptas</span>
    </div>
    <div class="kpi-tile">
      <span class="kpi-tile__val kpi-tile__val--warn">${report.summary.warned}</span>
      <span class="kpi-tile__label">Observaciones</span>
    </div>
    <div class="kpi-tile">
      <span class="kpi-tile__val kpi-tile__val--fail">${report.summary.failed}</span>
      <span class="kpi-tile__label">Desfavorables</span>
    </div>
    <div class="kpi-tile">
      <span class="kpi-tile__val">${report.summary.skipped}</span>
      <span class="kpi-tile__label">Omitidas</span>
    </div>
    <div class="kpi-tile">
      <span class="kpi-tile__val">${seconds}s</span>
      <span class="kpi-tile__label">Tiempo total</span>
    </div>
  `;

  renderSecurityChecklist(checklistSection, report.securityChecklist);
}

function stopInspection(message = 'Inspección detenida por el usuario.') {
  if (activeSource) {
    activeSource.close();
    activeSource = null;
  }
  setRunningUi(false);
  if (message) {
    liveStatus.textContent = message;
  }
}

function startInspection(repoPath, slowMotionMs, minCoverage, targetUrl) {
  stopInspection('');
  resetRunState();
  setRunningUi(true);
  liveStatus.textContent = 'Detectando stack del repositorio…';

  const params = new URLSearchParams({
    repoPath,
    slowMotionMs: String(slowMotionMs),
    minCoverage: String(minCoverage)
  });
  if (targetUrl) {
    params.set('targetUrl', targetUrl);
  }

  const source = new EventSource(`/api/inspect/stream?${params.toString()}`);
  activeSource = source;

  source.addEventListener('inspection:start', (event) => {
    const data = JSON.parse(event.data);
    stackPill.textContent = `Stack: ${data.stack.detectedStacks.join(' + ')}`;
    branchPill.textContent = `Rama: ${data.stack.gitBranch ?? 'sin git'}`;
    liveStatus.textContent = `Inspeccionando ${data.stack.repoName}…`;
  });

  source.addEventListener('station:start', (event) => {
    const data = JSON.parse(event.data);
    stationState.set(data.station.id, 'running');
    liveStatus.textContent = `En curso: ${data.station.name}`;
    renderAll();
  });

  source.addEventListener('station:complete', (event) => {
    const data = JSON.parse(event.data);
    stationState.set(data.result.id, data.result.status);
    stationResults.set(data.result.id, data.result);
    if (data.result.securityChecklist) {
      renderSecurityChecklist(checklistSection, data.result.securityChecklist);
    }
    renderAll();
  });

  source.addEventListener('inspection:complete', (event) => {
    const data = JSON.parse(event.data);
    lastReport = data.report;
    renderVerdict(data.report);
    stopInspection(`Completada · ${data.report.verdict}`);
  });

  source.addEventListener('inspection:error', (event) => {
    const data = JSON.parse(event.data);
    showError(data.message || 'Error durante la inspección.');
    setTrafficLight('fail');
    stopInspection('Inspección interrumpida.');
  });

  source.onerror = () => {
    if (activeSource) {
      showError('Se perdió la conexión con el servidor local de la ITV.');
      setTrafficLight('fail');
      stopInspection('Conexión cerrada.');
    }
  };
}

function triggerDownload(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const repoPath = repoPathInput.value.trim();
  if (!repoPath) {
    showError('Ingresá una ruta local de repositorio.');
    return;
  }
  startInspection(
    repoPath,
    Number(slowMotionSelect.value),
    Number(minCoverageInput.value || 75),
    targetUrlInput ? targetUrlInput.value.trim() : ''
  );
});

stopBtn.addEventListener('click', () => {
  setTrafficLight('');
  stopInspection('Inspección cancelada por el usuario.');
});

if (browseBtn) {
  browseBtn.addEventListener('click', async () => {
    clearError();
    browseBtn.disabled = true;
    const originalText = browseBtn.textContent;
    browseBtn.textContent = 'Abriendo…';
    try {
      const response = await fetch('/api/pick-folder', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo abrir el selector de carpetas.');
      }
      if (!data.cancelled && data.path) {
        repoPathInput.value = data.path;
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Error abriendo selector de carpetas.');
    } finally {
      browseBtn.disabled = false;
      browseBtn.textContent = originalText;
    }
  });
}

exportJsonBtn.addEventListener('click', () => {
  if (!lastReport) return;
  triggerDownload(
    `itv-evidencia-${lastReport.stack.repoName}.json`,
    JSON.stringify(lastReport, null, 2),
    'application/json'
  );
});

exportMdBtn.addEventListener('click', async () => {
  if (!lastReport) return;
  try {
    const response = await fetch('/api/export/markdown', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lastReport)
    });
    if (!response.ok) {
      throw new Error('No se pudo generar el reporte Markdown.');
    }
    const markdown = await response.text();
    triggerDownload(
      `itv-evidencia-${lastReport.stack.repoName}.md`,
      markdown,
      'text/markdown; charset=utf-8'
    );
  } catch (error) {
    showError(error instanceof Error ? error.message : 'Error exportando evidencia.');
  }
});

async function bootstrap() {
  try {
    const [healthRes, stationsRes] = await Promise.all([
      fetch('/api/health'),
      fetch('/api/stations')
    ]);
    const health = await healthRes.json();
    const stationsPayload = await stationsRes.json();

    if (health.defaultRepoPath && !repoPathInput.value) {
      repoPathInput.value = health.defaultRepoPath;
    }
    catalogStations = stationsPayload.stations ?? [];
    renderAll();
  } catch {
    showError('No se pudo inicializar el dashboard local.');
  }
}

void bootstrap();
