import { downloadJSON } from '../export/json.js';
import { downloadCSV } from '../export/csv.js';

let panelEl = null;
let isDragging = false;
let dragOffset = { x: 0, y: 0 };
let dragMoveHandler = null;
let dragUpHandler = null;
let autoMinimizeTimer = null;

const AUTO_MINIMIZE_DELAY = 5000;

function buildExportFilename(schoolName, extension) {
  const baseName = (schoolName || 'school')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_-]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `${baseName || 'school'}.${extension}`;
}

function startAutoMinimizeTimer() {
  clearTimeout(autoMinimizeTimer);
  autoMinimizeTimer = setTimeout(() => {
    if (panelEl) panelEl.classList.add('minimized');
  }, AUTO_MINIMIZE_DELAY);
}

function resetAutoMinimizeTimer() {
  if (panelEl && panelEl.classList.contains('minimized')) {
    panelEl.classList.remove('minimized');
  }
  startAutoMinimizeTimer();
}

/**
 * Injects or updates the floating summary panel on the current page.
 *
 * @param {object} params
 * @param {object|null} params.data - Normalized scattergram data, or null.
 * @param {string|null} params.parseError - Error message if parsing failed.
 * @param {number|null} params.parserTier - Which tier succeeded.
 * @param {string} params.capturedAt - ISO timestamp of last successful parse.
 */
export function showPanel({ data, parseError, parserTier, capturedAt }) {
  injectCSS();

  if (panelEl) panelEl.remove();

  panelEl = document.createElement('div');
  panelEl.id = 'naviance-viewer-panel';
  panelEl.innerHTML = buildPanelHTML({ data, parseError, parserTier, capturedAt });
  (document.body ?? document.documentElement).appendChild(panelEl);

  bindDrag(panelEl);

  // Auto-minimize after 5s; hovering resets the countdown and expands if minimized
  startAutoMinimizeTimer();
  panelEl.addEventListener('mouseenter', resetAutoMinimizeTimer);
  panelEl.addEventListener('mouseleave', startAutoMinimizeTimer);

  panelEl.querySelector('#naviance-viewer-minimize')?.addEventListener('click', () => {
    panelEl.classList.toggle('minimized');
    // If manually expanded, restart the countdown
    if (!panelEl.classList.contains('minimized')) startAutoMinimizeTimer();
  });

  panelEl.querySelector('#naviance-viewer-close')?.addEventListener('click', () => {
    removePanel();
  });

  if (data) {
    const schoolName = data.school?.name ?? 'school';

    panelEl.querySelector('#naviance-viewer-export-json')?.addEventListener('click', () => {
      downloadJSON(data, buildExportFilename(schoolName, 'json'));
    });

    panelEl.querySelector('#naviance-viewer-export-csv')?.addEventListener('click', () => {
      downloadCSV(data, buildExportFilename(schoolName, 'csv'));
    });
  }

  panelEl.querySelector('#naviance-viewer-reparse')?.addEventListener('click', () => {
    window.location.reload();
  });
}

export function removePanel() {
  clearTimeout(autoMinimizeTimer);
  autoMinimizeTimer = null;
  if (panelEl) {
    panelEl.remove();
    panelEl = null;
  }
  if (dragMoveHandler) {
    document.removeEventListener('mousemove', dragMoveHandler);
    dragMoveHandler = null;
  }
  if (dragUpHandler) {
    document.removeEventListener('mouseup', dragUpHandler);
    dragUpHandler = null;
  }
}

function buildPanelHTML({ data, parseError, parserTier, capturedAt }) {
  const schoolName = data?.school?.name ?? 'Scattergram';
  const dateStr = capturedAt ? new Date(capturedAt).toLocaleDateString() : 'unknown';
  const tierStr = parserTier ? `Tier ${parserTier}` : '';

  const stats = data ? computeSummaryStats(data) : null;

  return `
    <div class="naviance-viewer-header">
      <span class="naviance-viewer-title" title="${escapeHTML(schoolName)}">${escapeHTML(schoolName)}</span>
      <div class="naviance-viewer-header-actions">
        <button id="naviance-viewer-minimize" title="Minimize">—</button>
        <button id="naviance-viewer-close" title="Close">✕</button>
      </div>
    </div>
    <div class="naviance-viewer-body">
      <div class="naviance-viewer-meta">Last parsed: ${dateStr}${tierStr ? ` · ${tierStr}` : ''}</div>
      ${parseError ? `<div class="naviance-viewer-error">⚠ Latest parse failed — showing saved data.<br><small>${escapeHTML(parseError)}</small></div>` : ''}
      ${stats ? buildStatsHTML(stats) : '<p style="color:#888;font-size:13px;">No data available.</p>'}
      <div class="naviance-viewer-actions">
        ${data ? `
          <button id="naviance-viewer-export-json" class="primary">Export JSON</button>
          <button id="naviance-viewer-export-csv">Export CSV</button>
        ` : `
          <button id="naviance-viewer-reparse">Re-parse page</button>
        `}
      </div>
    </div>
  `;
}

function buildStatsHTML(stats) {
  return `
    <div class="naviance-viewer-stats">
      <div class="naviance-viewer-stat">
        <div class="naviance-viewer-stat-label">Total Applicants</div>
        <div class="naviance-viewer-stat-value">${stats.total}</div>
      </div>
      <div class="naviance-viewer-stat">
        <div class="naviance-viewer-stat-label">Acceptance Rate</div>
        <div class="naviance-viewer-stat-value">${stats.acceptanceRate}</div>
      </div>
      <div class="naviance-viewer-stat">
        <div class="naviance-viewer-stat-label">GPA Range</div>
        <div class="naviance-viewer-stat-value">${stats.gpaRange}</div>
      </div>
      <div class="naviance-viewer-stat">
        <div class="naviance-viewer-stat-label">SAT Range</div>
        <div class="naviance-viewer-stat-value">${stats.satRange}</div>
      </div>
      <div class="naviance-viewer-stat">
        <div class="naviance-viewer-stat-label">ACT Range</div>
        <div class="naviance-viewer-stat-value">${stats.actRange}</div>
      </div>
      <div class="naviance-viewer-stat">
        <div class="naviance-viewer-stat-label">By Round</div>
        <div class="naviance-viewer-stat-value" style="font-size:12px;">${stats.byRound}</div>
      </div>
    </div>
  `;
}

function computeSummaryStats(data) {
  const gpa = data.scattergrams?.gpa;
  if (!gpa) return null;

  let total = 0, accepted = 0;
  const gpas = [], acts = [], sats = [];
  const roundCounts = {};

  // Determine the primary bucket for counting unique applicants.
  // ACT and SAT buckets overlap (same applicant appears in both),
  // so we count total/accepted/gpa/rounds from only one bucket.
  const primaryScoreType = gpa.act?.apps ? 'act' : 'sat';

  for (const scoreType of ['act', 'sat']) {
    const apps = gpa[scoreType]?.apps ?? {};
    for (const [outcomeKey, applicants] of Object.entries(apps)) {
      const isAccepted = outcomeKey.startsWith('accepted');
      const roundMatch = outcomeKey.match(/(RD|EA|ED2|ED|PRI)$/);
      const round = roundMatch ? roundMatch[1] : 'other';

      for (const a of applicants) {
        if (scoreType === primaryScoreType) {
          total++;
          if (isAccepted) accepted++;
          if (a.gpa) gpas.push(a.gpa);
          roundCounts[round] = (roundCounts[round] ?? 0) + 1;
        }
        if (scoreType === 'act' && a.actComposite) acts.push(a.actComposite);
        if (scoreType === 'sat') {
          const s = a.highestComboSatWWConvertedTo1600 ?? a.studentSATCompositeConvertedTo1600 ?? a.highestComboSat;
          if (s) sats.push(s);
        }
      }
    }
  }

  const rate = total > 0 ? `${Math.round((accepted / total) * 100)}%` : 'N/A';
  const gpaRange = gpas.length ? `${Math.min(...gpas).toFixed(2)}–${Math.max(...gpas).toFixed(2)}` : 'N/A';
  const satRange = sats.length ? `${Math.min(...sats)}–${Math.max(...sats)}` : 'N/A';
  const actRange = acts.length ? `${Math.min(...acts)}–${Math.max(...acts)}` : 'N/A';
  const byRound = Object.entries(roundCounts).map(([r, c]) => `${r}:${c}`).join(' ');

  return { total, acceptanceRate: rate, gpaRange, satRange, actRange, byRound };
}

function bindDrag(panel) {
  const header = panel.querySelector('.naviance-viewer-header');

  // Remove any previous document-level drag listeners before adding new ones
  if (dragMoveHandler) document.removeEventListener('mousemove', dragMoveHandler);
  if (dragUpHandler) document.removeEventListener('mouseup', dragUpHandler);

  header.addEventListener('mousedown', (e) => {
    isDragging = true;
    const rect = panel.getBoundingClientRect();
    dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    panel.style.right = 'auto';
    e.preventDefault();
  });

  dragMoveHandler = (e) => {
    if (!isDragging) return;
    panel.style.left = `${e.clientX - dragOffset.x}px`;
    panel.style.top = `${e.clientY - dragOffset.y}px`;
  };

  dragUpHandler = () => { isDragging = false; };

  document.addEventListener('mousemove', dragMoveHandler);
  document.addEventListener('mouseup', dragUpHandler);
}

function injectCSS() {
  if (document.getElementById('naviance-viewer-styles')) return;
  const link = document.createElement('link');
  link.id = 'naviance-viewer-styles';
  link.rel = 'stylesheet';
  link.href = chrome.runtime.getURL('ui/panel.css');
  document.head.appendChild(link);
}

function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
