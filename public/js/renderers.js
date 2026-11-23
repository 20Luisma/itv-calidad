export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function statusLabel(status) {
  switch (status) {
    case 'pass':
      return 'Apto';
    case 'warn':
      return 'Observación';
    case 'fail':
      return 'Desfavorable';
    case 'skipped':
      return 'Omitida';
    case 'running':
      return 'Escaneando…';
    case 'manual':
      return 'Fuera del código';
    default:
      return 'Pendiente';
  }
}

const STATION_ICONS = {
  'syntax-config':
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
  'static-types':
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>',
  'tests-coverage':
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 3h6"/><path d="M10 3v6.5L4.5 19a1.5 1.5 0 0 0 1.3 2.2h12.4a1.5 1.5 0 0 0 1.3-2.2L14 9.5V3"/></svg>',
  'security-cves':
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  'e2e-browser':
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
  'accessibility-ui':
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="5" r="2"/><path d="M4 9h16"/><path d="M12 9v12"/><path d="M9 21l3-6 3 6"/></svg>',
  'code-health-observability':
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>'
};

function iconFor(stationId) {
  return STATION_ICONS[stationId] ?? STATION_ICONS['syntax-config'];
}

export function renderTrackNodes(container, stations, stateMap) {
  container.innerHTML = stations
    .map((station) => {
      const state = stateMap.get(station.id) ?? 'pending';
      return `
        <li class="track-node track-node--${escapeHtml(state)}" data-station-id="${escapeHtml(station.id)}">
          <div class="track-node__top">
            <span class="track-node__icon">${iconFor(station.id)}</span>
            <span class="track-node__num">0${escapeHtml(station.order)}</span>
          </div>
          <span class="track-node__name">${escapeHtml(station.shortName)}</span>
          <span class="track-node__state">${escapeHtml(statusLabel(state))}</span>
        </li>
      `;
    })
    .join('');
}

function renderFindings(findings) {
  if (!findings || findings.length === 0) {
    return '<p class="section-hint">Sin hallazgos negativos en esta estación.</p>';
  }

  return `
    <ul class="findings-list">
      ${findings
        .map((finding) => {
          const location = finding.file
            ? `${finding.file}${finding.line ? `:${finding.line}` : ''}`
            : '';
          return `
            <li class="finding-item finding-item--${escapeHtml(finding.severity)}">
              <div class="finding-item__title">${escapeHtml(finding.title)}</div>
              ${location ? `<div class="finding-item__meta">${escapeHtml(location)}</div>` : ''}
              <p class="finding-item__reason"><strong>Motivo:</strong> ${escapeHtml(finding.reason)}</p>
              <p class="finding-item__fix"><strong>Cómo arreglarlo:</strong> ${escapeHtml(finding.howToFix)}</p>
            </li>
          `;
        })
        .join('')}
    </ul>
  `;
}

export function renderStationCards(container, catalogStations, resultsMap, stateMap) {
  container.innerHTML = catalogStations
    .map((meta) => {
      const state = stateMap.get(meta.id) ?? 'pending';
      const result = resultsMap.get(meta.id);
      const isOpen = state === 'fail' || state === 'warn' || state === 'running';

      return `
        <details class="station-card station-card--${escapeHtml(state)}" ${isOpen ? 'open' : ''}>
          <summary class="station-card__summary">
            <div class="station-card__left">
              <span class="station-card__icon">${iconFor(meta.id)}</span>
              <div class="station-card__title-group">
                <span class="station-card__name">${escapeHtml(meta.name)}</span>
                <span class="station-card__subtitle">${escapeHtml(
                  result ? result.summary : meta.didactic.whatItChecks
                )}</span>
              </div>
            </div>
            <div class="station-card__right">
              ${
                result
                  ? `<span class="station-duration">${escapeHtml(result.durationMs)} ms</span>`
                  : ''
              }
              <span class="status-chip status-chip--${escapeHtml(state)}">${escapeHtml(
                statusLabel(state)
              )}</span>
              <span class="station-chevron" aria-hidden="true">▾</span>
            </div>
          </summary>

          <div class="station-card__body">
            <div class="didactic-grid">
              <div class="didactic-box">
                <div class="didactic-box__label">¿Qué revisa esta estación?</div>
                <p class="didactic-box__text">${escapeHtml(meta.didactic.whatItChecks)}</p>
              </div>
              <div class="didactic-box">
                <div class="didactic-box__label">¿Por qué importa antes del push?</div>
                <p class="didactic-box__text">${escapeHtml(meta.didactic.whyItMatters)}</p>
              </div>
            </div>

            <div class="terminal-box">
              <div class="terminal-box__bar">
                <span class="terminal-dot terminal-dot--red" aria-hidden="true"></span>
                <span class="terminal-dot terminal-dot--yellow" aria-hidden="true"></span>
                <span class="terminal-dot terminal-dot--green" aria-hidden="true"></span>
                <span class="terminal-box__title">comando ejecutado</span>
              </div>
              <div class="cmd-box">$ ${escapeHtml(result ? result.command : meta.didactic.toolsByStack)}</div>
            </div>

            ${
              result
                ? `
                  <div>
                    <div class="didactic-box__label">Hallazgos y cómo arreglarlo</div>
                    ${renderFindings(result.findings)}
                  </div>
                  <div class="terminal-box">
                    <div class="terminal-box__bar">
                      <span class="terminal-dot terminal-dot--red" aria-hidden="true"></span>
                      <span class="terminal-dot terminal-dot--yellow" aria-hidden="true"></span>
                      <span class="terminal-dot terminal-dot--green" aria-hidden="true"></span>
                      <span class="terminal-box__title">salida real</span>
                    </div>
                    <pre class="raw-output">${escapeHtml(result.rawOutput || 'Sin salida')}</pre>
                  </div>
                `
                : ''
            }
          </div>
        </details>
      `;
    })
    .join('');
}

export function renderSecurityChecklist(sectionEl, checklist) {
  if (!checklist) {
    sectionEl.hidden = true;
    return;
  }

  sectionEl.hidden = false;
  const disclaimerEl = document.getElementById('checklist-disclaimer');
  const scoreEl = document.getElementById('checklist-score');
  const progressEl = document.getElementById('checklist-progress');
  const autoListEl = document.getElementById('checklist-automated');
  const opListEl = document.getElementById('checklist-operational');

  if (disclaimerEl) disclaimerEl.textContent = checklist.disclaimer;
  if (scoreEl) {
    scoreEl.textContent = `${checklist.scorePercent}% (${checklist.automatedPassed}/${checklist.automatedTotal} automáticos)`;
  }
  if (progressEl) {
    progressEl.value = checklist.scorePercent;
  }

  const renderItem = (item) => {
    const chipClass =
      item.status === 'manual' ? 'status-chip--pending' : `status-chip--${escapeHtml(item.status)}`;
    return `
      <li class="checklist-item">
        <div class="checklist-item__top">
          <div>
            <div class="checklist-item__title">${escapeHtml(item.title)}</div>
            <div class="checklist-item__std">${escapeHtml(item.standardRef)}</div>
          </div>
          <span class="status-chip ${chipClass}">${escapeHtml(statusLabel(item.status))}</span>
        </div>
        <p class="checklist-item__detail">${escapeHtml(item.detail)}</p>
        <p class="checklist-item__rec"><strong>Acción:</strong> ${escapeHtml(item.recommendation)}</p>
      </li>
    `;
  };

  if (autoListEl) {
    autoListEl.innerHTML = checklist.items
      .filter((i) => i.category === 'automated')
      .map(renderItem)
      .join('');
  }
  if (opListEl) {
    opListEl.innerHTML = checklist.items
      .filter((i) => i.category === 'operational')
      .map(renderItem)
      .join('');
  }
}
