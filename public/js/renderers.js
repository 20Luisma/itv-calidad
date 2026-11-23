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
      return 'Inspeccionando…';
    case 'manual':
      return 'Revisar fuera del código';
    default:
      return 'Pendiente';
  }
}

export function renderTrackNodes(container, stations, stateMap) {
  container.innerHTML = stations
    .map((station) => {
      const state = stateMap.get(station.id) ?? 'pending';
      return `
        <li class="track-node track-node--${escapeHtml(state)}" data-station-id="${escapeHtml(station.id)}">
          <span class="track-node__num">Estación ${escapeHtml(station.order)}</span>
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
            <div class="station-card__title-group">
              <span class="station-card__name">${escapeHtml(meta.name)}</span>
              <span class="station-card__subtitle">${escapeHtml(
                result ? result.summary : meta.didactic.whatItChecks
              )}</span>
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

            <div>
              <div class="didactic-box__label">Comando ejecutado</div>
              <div class="cmd-box">${escapeHtml(result ? result.command : meta.didactic.toolsByStack)}</div>
            </div>

            ${
              result
                ? `
                  <div>
                    <div class="didactic-box__label">Hallazgos y cómo arreglarlo</div>
                    ${renderFindings(result.findings)}
                  </div>
                  <div>
                    <div class="didactic-box__label">Salida real</div>
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
  const autoListEl = document.getElementById('checklist-automated');
  const opListEl = document.getElementById('checklist-operational');

  if (disclaimerEl) disclaimerEl.textContent = checklist.disclaimer;
  if (scoreEl) {
    scoreEl.textContent = `${checklist.scorePercent}% (${checklist.automatedPassed}/${checklist.automatedTotal} automáticos)`;
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
