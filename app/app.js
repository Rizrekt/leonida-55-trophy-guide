// Entry point for the Leonida 55 tracker. Loads the trophy document once, boots
// the progress store (seeding the demo state only when the URL asks for it),
// and renders the always-on furniture: the audit strip and the progress header.
// The four views are filled by their own modules; each one is looked up here so
// the shell never has to know how a view is drawn.

import { createStore } from './js/tracker-store.js';
import { applyDemo, demoRequested, DEMO_FOCUS_ID } from './js/demo-seed.js';
import { renderTracker, selectTrophy, currentTrophy } from './js/guide-render.js';
import { renderRoadmap } from './js/roadmap.js';
import { renderSources, focusSource } from './js/source-matrix.js';
import { renderBackup, renderMissables } from './js/backup.js';

const GRADE_ORDER = ['platinum', 'gold', 'silver', 'bronze'];
const GRADE_KEY = { platinum: 'P', gold: 'G', silver: 'S', bronze: 'B' };
const VIEW_NAMES = ['tracker', 'roadmap', 'sources', 'missables'];
const DATA_URL = 'data/trophies.json';

const el = {
  mastheadMeta: document.getElementById('masthead-meta'),
  audit: document.getElementById('audit-strip'),
  earned: document.getElementById('earned-count'),
  total: document.getElementById('total-count'),
  grades: document.getElementById('grade-counters'),
  fill: document.getElementById('progress-fill'),
  saveFlag: document.getElementById('save-flag'),
  exportBtn: document.getElementById('export'),
  importBtn: document.getElementById('import-trigger'),
  importInput: document.getElementById('import'),
  importMsg: document.getElementById('import-msg'),
  spoilerToggle: document.getElementById('spoiler-toggle'),
  tabs: Array.from(document.querySelectorAll('.tab')),
  views: {
    tracker: document.getElementById('view-tracker'),
    roadmap: document.getElementById('view-roadmap'),
    sources: document.getElementById('view-sources'),
    missables: document.getElementById('view-missables'),
  },
};

// One render function per view, registered below. Each receives the document,
// the store, the view's own name and an optional trophy to focus.
const renderers = new Map();

let doc = null;
let store = null;
let activeView = 'tracker';
let importMsgTimer = 0;
let pendingFocusId = null;
let pendingSource = null;

/* ------------------------------------------------------------------ data */

async function loadDocument() {
  const response = await fetch(DATA_URL, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const parsed = await response.json();
  if (!parsed || !Array.isArray(parsed.trophies)) {
    throw new Error('trophies.json has no trophy array');
  }
  return parsed;
}

/* ------------------------------------------------------------- audit strip */

function computeAudit(data) {
  const trophies = data.trophies;
  let steps = 0;
  let citedSteps = 0;
  let guidesWithSource = 0;

  for (const trophy of trophies) {
    const list = Array.isArray(trophy.steps) ? trophy.steps : [];
    let citedInTrophy = 0;
    for (const step of list) {
      steps += 1;
      if (Array.isArray(step.cite) && step.cite.length > 0) {
        citedSteps += 1;
        citedInTrophy += 1;
      }
    }
    if (citedInTrophy > 0) guidesWithSource += 1;
  }

  const trophyDisagreements = trophies.reduce(
    (sum, t) => sum + (Array.isArray(t.disagree) ? t.disagree.length : 0),
    0,
  );
  const listDisagreements = Array.isArray(data.disagreements) ? data.disagreements.length : 0;

  return {
    total: trophies.length,
    guidesWithSource,
    steps,
    citedSteps,
    sources: Array.isArray(data.sources) ? data.sources.length : 0,
    hidden: trophies.filter((t) => t.hidden === true).length,
    // The collected disputes are the canonical count; the inline boxes on
    // individual trophies restate some of them, so they are reported apart.
    disagreements: listDisagreements,
    listDisagreements,
    trophyDisagreements,
    inlineTrophies: trophies
      .filter((t) => Array.isArray(t.disagree) && t.disagree.length > 0)
      .map((t) => `#${t.id}`),
  };
}

function sourceDateLabel(sources) {
  const dates = (Array.isArray(sources) ? sources : [])
    .map((s) => String(s.date ?? ''))
    .join(' ')
    .match(/\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}/g);
  if (!dates || dates.length === 0) return null;
  const latest = dates
    .map((d) => ({ d, t: Date.parse(d) }))
    .filter((x) => Number.isFinite(x.t))
    .sort((a, b) => b.t - a.t)[0];
  return latest ? latest.d : null;
}

function auditItem(html) {
  const span = document.createElement('span');
  span.className = 'audit__item';
  span.innerHTML = html;
  return span;
}

function auditDot() {
  const dot = document.createElement('span');
  dot.className = 'audit__dot';
  dot.setAttribute('aria-hidden', 'true');
  dot.textContent = '·';
  return dot;
}

function renderAudit(data) {
  const a = computeAudit(data);
  const frag = document.createDocumentFragment();

  const tag = document.createElement('span');
  tag.className = 'audit__tag';
  tag.textContent = 'Audit';
  frag.append(tag);

  const guidesOk = a.guidesWithSource === a.total;
  frag.append(
    auditItem(
      `<b>${a.guidesWithSource}/${a.total}</b> guides cite a source${guidesOk ? '' : ' — check'}`,
    ),
    auditDot(),
    auditItem(`<b>${a.citedSteps}/${a.steps}</b> steps cited`),
    auditDot(),
    auditItem(
      `<b>${a.sources}</b> sources${(() => {
        const label = sourceDateLabel(data.sources);
        return label ? ` read ${label}` : '';
      })()}`,
    ),
    auditDot(),
    auditItem(`<b>${a.hidden}</b> hidden`),
    auditDot(),
    auditItem(`disagreements shown: <b>${a.disagreements}</b>`),
  );

  const inlineNote = a.inlineTrophies.length
    ? `Collected in the Sources view: ${a.disagreements}. Inline boxes on ${a.inlineTrophies.join(', ')} restate ${a.trophyDisagreements} of them.`
    : `Collected in the Sources view: ${a.disagreements}.`;
  el.audit.title = inlineNote;

  el.audit.replaceChildren(frag);
}

/* --------------------------------------------------------- progress header */

function gradeTotals(data) {
  const totals = { platinum: 0, gold: 0, silver: 0, bronze: 0 };
  for (const trophy of data.trophies) {
    if (totals[trophy.grade] !== undefined) totals[trophy.grade] += 1;
  }
  return totals;
}

function earnedByGrade(data) {
  const counts = { platinum: 0, gold: 0, silver: 0, bronze: 0 };
  for (const trophy of data.trophies) {
    if (counts[trophy.grade] !== undefined && store.isEarned(trophy.id)) {
      counts[trophy.grade] += 1;
    }
  }
  return counts;
}

function renderProgress() {
  if (!doc) return;
  const totals = gradeTotals(doc);
  const earned = earnedByGrade(doc);
  const earnedCount = doc.trophies.filter((t) => store.isEarned(t.id)).length;

  el.earned.textContent = String(earnedCount);
  el.total.textContent = `/${doc.trophies.length}`;
  el.fill.style.width = `${(earnedCount / doc.trophies.length) * 100}%`;

  el.grades.replaceChildren(
    ...GRADE_ORDER.map((grade) => {
      const li = document.createElement('li');
      li.className = `grade-count grade-count--${grade}`;
      li.title = `${grade}: ${earned[grade]} of ${totals[grade]} earned`;
      li.innerHTML =
        `<span class="grade-count__key">${GRADE_KEY[grade]}</span>` +
        `<span class="grade-count__value">${earned[grade]}/${totals[grade]}</span>`;
      return li;
    }),
  );

  renderSaveFlag();
}

function renderSaveFlag() {
  if (!store) return;
  const has = store.hasChanged;
  el.saveFlag.textContent = has ? 'Saved in this browser' : 'No saved progress yet';
  el.saveFlag.classList.toggle('is-changed', has);
  el.saveFlag.title = has && store.updatedAt
    ? `Last written ${new Date(store.updatedAt).toLocaleString()}`
    : 'Progress is written to this browser as you tick trophies';
  if (!store.storageAvailable) {
    el.saveFlag.textContent = 'Storage blocked — export to keep progress';
    el.saveFlag.classList.remove('is-changed');
  }
}

/* ------------------------------------------------------------ export/import */

function exportFilename() {
  const stamp = new Date().toISOString().slice(0, 10);
  return `leonida55-progress-${stamp}.json`;
}

function handleExport() {
  const blob = new Blob([store.exportState()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = exportFilename();
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  setImportMessage('Exported to a file in your downloads.');
}

function setImportMessage(text, tone = 'info') {
  el.importMsg.textContent = text;
  el.importMsg.style.color = tone === 'error' ? 'var(--rust)' : 'var(--ochre)';
  clearTimeout(importMsgTimer);
  if (text) importMsgTimer = setTimeout(() => { el.importMsg.textContent = ''; }, 5000);
}

async function handleImportFile(file) {
  if (!file) return '';
  try {
    const text = await file.text();
    const result = store.importState(text);
    const message = `Imported ${result.earned} earned${result.counters ? ` and ${result.counters} counters` : ''}.`;
    setImportMessage(message);
    return message;
  } catch (error) {
    const message = error.message || 'That file could not be imported.';
    setImportMessage(message, 'error');
    return message;
  } finally {
    el.importInput.value = '';
  }
}

function wireBackup() {
  el.exportBtn.addEventListener('click', handleExport);
  el.importBtn.addEventListener('click', () => el.importInput.click());
  el.importInput.addEventListener('change', () => {
    handleImportFile(el.importInput.files?.[0]).catch((error) => {
      setImportMessage(error.message || 'Import failed.', 'error');
    });
  });
}

/* ------------------------------------------------------------------- views */

function normaliseView(value) {
  return VIEW_NAMES.includes(value) ? value : 'tracker';
}

function setView(name, { push = false } = {}) {
  const next = normaliseView(name);
  activeView = next;

  for (const [key, section] of Object.entries(el.views)) {
    const on = key === next;
    section.classList.toggle('is-active', on);
    section.hidden = !on;
  }
  for (const tab of el.tabs) {
    const on = tab.dataset.view === next;
    tab.classList.toggle('is-active', on);
    tab.setAttribute('aria-selected', String(on));
    tab.tabIndex = on ? 0 : -1;
  }

  syncUrl({ view: next, push });
  renderActiveView();
}

function renderActiveView() {
  if (!doc || !store) return;
  const render = renderers.get(activeView);
  if (render) {
    render({ doc, store, view: activeView, focusId: pendingFocusId });
    pendingFocusId = null;
  }
  if (activeView === 'sources' && pendingSource) {
    if (focusSource(pendingSource)) pendingSource = null;
  }
}

/* --------------------------------------------------------- view modules */

renderers.set('tracker', ({ doc: data, store: progress, focusId }) => {
  renderTracker({ doc: data, store: progress, focusId });
});

renderers.set('roadmap', ({ doc: data }) => {
  renderRoadmap(document.getElementById('roadmap-body'), data);
});

renderers.set('sources', ({ doc: data }) => {
  renderSources(document.getElementById('sources-body'), data);
});

renderers.set('missables', ({ doc: data, store: progress }) => {
  renderMissables(document.getElementById('missables-body'), data, progress, (id) => {
    openTrophy(id);
  });
  renderBackup(document.getElementById('backup-body'), progress, {
    total: data.trophies.length,
    onExport: handleExport,
    onImport: (file) => handleImportFile(file),
    onReset: () => progress.clear(),
  });
});

/**
 * Jump to the tracker with one trophy selected. Used by the missables list and
 * by any cross-view link; the tracker renderer keeps the selection itself.
 */
function openTrophy(id) {
  pendingFocusId = Number(id);
  setView('tracker', { push: true });
}

// A citation chip anywhere dispatches this; the Sources view is the only place
// that can answer it, so the shell parks the id and changes view — the sources
// renderer picks the row up at the end of its own render.
document.addEventListener('leonida:cite', (event) => {
  const source = event.detail?.source;
  if (!source) return;
  pendingSource = String(source);
  setView('sources', { push: true });
});

function syncUrl({ view, push = false }) {
  try {
    const url = new URL(window.location.href);
    if (view && view !== 'tracker') url.searchParams.set('view', view);
    else url.searchParams.delete('view');
    const next = `${url.pathname}${url.search}${url.hash}`;
    if (push) window.history.pushState({ view }, '', next);
    else window.history.replaceState({ view }, '', next);
  } catch {
    /* file:// in some browsers refuses history writes; the view still changes. */
  }
}

function wireTabs() {
  for (const tab of el.tabs) {
    tab.addEventListener('click', () => setView(tab.dataset.view, { push: true }));
    tab.addEventListener('keydown', (event) => {
      const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
      if (!step) return;
      event.preventDefault();
      const index = VIEW_NAMES.indexOf(tab.dataset.view);
      const target = el.tabs[(index + step + VIEW_NAMES.length) % VIEW_NAMES.length];
      target.focus();
      setView(target.dataset.view, { push: true });
    });
  }
  window.addEventListener('popstate', () => {
    setView(new URLSearchParams(window.location.search).get('view'), { push: false });
  });
}

/* --------------------------------------------------------- spoiler toggle */

function renderSpoilerToggle() {
  const shown = store.spoilersShown;
  el.spoilerToggle.setAttribute('aria-pressed', String(shown));
  el.spoilerToggle.textContent = shown ? 'Spoilers: shown' : 'Spoilers: hidden';
  el.spoilerToggle.title = shown
    ? 'Hidden trophy names are visible. Click to mask them again.'
    : 'Hidden trophy names are masked. Click to show every name.';
}

function wireSpoilerToggle() {
  el.spoilerToggle.addEventListener('click', () => {
    store.setSpoilersShown(!store.spoilersShown);
  });
}

/* -------------------------------------------------------------------- boot */

function showLoadError(error) {
  const fromFile = window.location.protocol === 'file:';
  el.audit.replaceChildren();
  const tag = document.createElement('span');
  tag.className = 'audit__tag';
  tag.textContent = 'Offline';
  const message = document.createElement('span');
  message.className = 'audit__item';
  message.style.whiteSpace = 'normal';
  message.textContent = fromFile
    ? 'Browsers block module scripts and data files opened from the filesystem. Run "node serve.ts" in the project folder and open the local address it prints — everything still runs offline.'
    : 'Could not read data/trophies.json. Check that the app folder is served from its root, then reload.';
  el.audit.append(tag, message);
  el.earned.textContent = '—';
  el.total.textContent = '/55';
  console.error('Leonida 55: data load failed', error);
}

async function boot() {
  store = createStore();
  const demo = demoRequested();
  if (demo) applyDemo(store);

  store.subscribe(() => {
    renderProgress();
    renderSpoilerToggle();
    renderActiveView();
  });

  wireBackup();
  wireTabs();
  wireSpoilerToggle();
  renderSpoilerToggle();

  try {
    doc = await loadDocument();
  } catch (error) {
    showLoadError(error);
    return;
  }

  const meta = [doc.game, doc.platform].filter(Boolean).join(' · ');
  if (meta) el.mastheadMeta.textContent = meta;
  if (doc.list) el.mastheadMeta.title = doc.list;

  renderAudit(doc);
  renderProgress();

  const requestedView = new URLSearchParams(window.location.search).get('view');
  if (demo) pendingFocusId = DEMO_FOCUS_ID;
  setView(requestedView || 'tracker', { push: false });
}

boot();
