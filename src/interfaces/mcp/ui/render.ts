export interface FindingView {
  severity: 'error' | 'warning' | 'info';
  title: string;
  file?: string;
  line?: number;
  reason: string;
  howToFix: string;
}

export interface ExternalLinkView {
  label: string;
  url: string;
  status: string;
  summary: string;
}

export interface StationView {
  id: string;
  order: number;
  name: string;
  shortName: string;
  status: 'pass' | 'warn' | 'fail' | 'skipped';
  durationMs: number;
  summary: string;
  findings: FindingView[];
  externalLinks?: ExternalLinkView[];
}

export interface ChecklistItemView {
  category: 'automated' | 'operational';
  title: string;
  standardRef: string;
  status: string;
}

export interface ReportPayload {
  mode?: 'idle' | 'report';
  defaultRepoPath?: string;
  verdict?: 'APTO' | 'APTO_CON_OBSERVACIONES' | 'DESFAVORABLE';
  blocksPush?: boolean;
  repoName?: string;
  repoPath?: string;
  primaryStack?: string;
  gitBranch?: string;
  totalDurationMs?: number;
  summary?: { total: number; passed: number; warned: number; failed: number; skipped: number };
  securityChecklist?: {
    scorePercent: number;
    automatedPassed: number;
    automatedTotal: number;
    items: ChecklistItemView[];
  };
  stations?: StationView[];
}

export const DEFAULT_TRACK = [
  { order: 1, shortName: 'Sintaxis' },
  { order: 2, shortName: 'Tipos' },
  { order: 3, shortName: 'Tests' },
  { order: 4, shortName: 'Seguridad' },
  { order: 5, shortName: 'E2E' },
  { order: 6, shortName: 'WCAG UI' },
  { order: 7, shortName: 'Deuda & Obs.' }
];

const STATUS_LABELS: Record<string, string> = {
  pass: 'Apto',
  warn: 'Observación',
  fail: 'Fallo',
  skipped: 'Omitida',
  running: 'Escaneando…'
};

export function esc(val: unknown): string {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function statusText(status: string): string {
  return STATUS_LABELS[status] ?? 'Pendiente';
}

export function buildIdleTrackHtml(activeIndex: number): string {
  return DEFAULT_TRACK.map((s, idx) => {
    const state = activeIndex === idx ? 'running' : activeIndex > idx ? 'pass' : 'pending';
    const label = state === 'running' ? 'Escaneando…' : state === 'pass' ? 'Revisada' : 'Pendiente';
    return `<div class="node node--${state}"><span class="node__num">0${s.order}</span><span class="node__name">${esc(s.shortName)}</span><span class="node__state">${label}</span></div>`;
  }).join('');
}

export function buildTrackHtml(stations: StationView[]): string {
  return stations
    .map(
      (st) =>
        `<button type="button" class="node node--${esc(st.status)}" data-jump="st-${st.order}"><span class="node__num">0${st.order}</span><span class="node__name">${esc(st.shortName)}</span><span class="node__state">${esc(statusText(st.status))}</span></button>`
    )
    .join('');
}

function buildFindingsHtml(st: StationView, canSendMessage: boolean): string {
  if (st.findings.length === 0) {
    return '<p class="brand__sub">Sin hallazgos negativos en esta estación.</p>';
  }
  return st.findings
    .slice(0, 10)
    .map((f, idx) => {
      const loc = f.file ? `${f.file}${f.line ? `:${f.line}` : ''}` : '';
      const fixBtn =
        canSendMessage && f.severity !== 'info'
          ? `<button type="button" class="btn btn--secondary btn--tiny" data-fix-st="${st.order}" data-fix-idx="${idx}">Arreglar con agente</button>`
          : '';
      return `<div class="finding finding--${esc(f.severity)}"><div class="finding__head"><span class="finding__title">${esc(f.title)}</span>${fixBtn}</div>${loc ? `<div class="finding__loc">${esc(loc)}</div>` : ''}<p class="finding__text">${esc(f.reason)}</p><p class="finding__fix"><strong>Cómo arreglarlo:</strong> ${esc(f.howToFix)}</p></div>`;
    })
    .join('');
}

export function buildStationsHtml(stations: StationView[], canSendMessage: boolean): string {
  return stations
    .map((st) => {
      const openAttr = st.status === 'fail' || st.status === 'warn' ? 'open' : '';
      const badgeCls = st.status === 'skipped' ? 'skip' : esc(st.status);
      const linksHtml =
        st.externalLinks && st.externalLinks.length > 0
          ? `<div class="links-row">${st.externalLinks
              .map(
                (l) =>
                  `<button type="button" class="btn btn--secondary btn--tiny" data-open-url="${esc(l.url)}">${esc(l.label)} ↗</button>`
              )
              .join('')}</div>`
          : '';
      return `<details id="st-${st.order}" class="st-card st-card--${esc(st.status)}" ${openAttr}><summary class="st-card__sum"><span><strong>0${st.order} · ${esc(st.shortName)}</strong> — <span class="brand__sub">${esc(st.summary)}</span></span><span class="badge badge--${badgeCls}">${esc(statusText(st.status))}</span></summary><div class="st-card__body">${linksHtml}${buildFindingsHtml(st, canSendMessage)}</div></details>`;
    })
    .join('');
}

export function buildChecklistHtml(items: ChecklistItemView[]): string {
  return items
    .filter((i) => i.category === 'automated')
    .map((item) => {
      const badgeType = item.status === 'pass' ? 'pass' : item.status === 'fail' ? 'fail' : 'warn';
      return `<div class="cl-item"><div><div class="cl-item__title">${esc(item.title)}</div><div class="cl-item__ref">${esc(item.standardRef)}</div></div><span class="badge badge--${badgeType}">${esc(item.status)}</span></div>`;
    })
    .join('');
}
