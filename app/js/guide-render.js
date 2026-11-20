// The tracker's three panels: filter pills, the grouped trophy list, and the
// detail column with its cited-sources aside. Markup is built as strings and
// inserted once; every click is delegated from a container that outlives the
// render, so re-drawing a view never strands a listener.
//
// The module also owns the small slice of view state that is not progress:
// which filter pill is on, what the search box holds, and which trophy the
// detail is showing. Progress itself stays in tracker-store.js.

const GRADE_KEY = { platinum: 'P', gold: 'G', silver: 'S', bronze: 'B' };
const GRADE_LABEL = { platinum: 'Platinum', gold: 'Gold', silver: 'Silver', bronze: 'Bronze' };
const MASKED_NAME = 'Hidden trophy';

// List order follows the roadmap rather than the official numbering: story
// first, then the completion/activity work, the collectibles, the stranger
// lines, and the misc odds and ends last.
const GROUPS = [
  { key: 'story', title: 'Story', match: (t) => t.type === 'Story' },
  { key: 'activities', title: 'Activities & completion', match: (t) => /^(Activity|Completion)\b/.test(t.type) },
  { key: 'collectibles', title: 'Collectibles & exploration', match: (t) => /^(Collectible|Exploration)\b/.test(t.type) },
  { key: 'side', title: 'Side quests', match: (t) => /^Side\b/.test(t.type) },
  { key: 'misc', title: 'Misc', match: () => true },
];

const FILTERS = [
  { key: 'all', label: 'All', test: () => true },
  { key: 'story', label: 'Story', test: (t) => t.type === 'Story' },
  { key: 'activities', label: 'Activities', test: (t) => /^(Activity|Completion)\b/.test(t.type) },
  { key: 'collectibles', label: 'Collectibles', test: (t) => /^(Collectible|Exploration)\b/.test(t.type) },
  { key: 'side', label: 'Side quests', test: (t) => /^Side\b/.test(t.type) },
  { key: 'misc', label: 'Misc', test: (t) => /^Misc\b/.test(t.type) },
  {
    key: 'watch',
    label: 'Possibly missable & watch',
    test: (t) => t.missable_status !== 'none' || t.method_status !== 'confirmed',
  },
  { key: 'hidden', label: 'Hidden', test: (t) => t.hidden === true },
  { key: 'earned', label: 'Earned', test: (t, store) => store.isEarned(t.id) },
  { key: 'unearned', label: 'Not yet', test: (t, store) => !store.isEarned(t.id) },
];

const MISSABLE_BADGE = {
  'possibly-unconfirmed': ['missable', 'Possibly missable'],
  confirmed: ['missable', 'Missable'],
};

const METHOD_BADGE = {
  'to-be-confirmed': ['method', 'Method to be confirmed'],
  'partly-confirmed': ['method', 'Partly confirmed'],
  inferred: ['method', 'Inferred'],
};

const MISSABLE_NOTE = {
  'possibly-unconfirmed':
    'Potentially missable, and unconfirmed. One source pair warns about the Chapter 1 meditation and another says nothing is missable; we keep the cautious label until someone settles it.',
  confirmed: 'Missable: finish it before the point of no return.',
};

const METHOD_NOTE = {
  confirmed: 'Method confirmed by the sources cited on the steps below.',
  'partly-confirmed':
    'Method partly confirmed: the outline is sourced, but one detail is still open — the steps say which.',
  'to-be-confirmed':
    'Method to be confirmed: no source has published the steps yet, so the guide reads the official description and labels the rest as inference.',
  inferred:
    'Method inferred from the official description. No source documents the route, so treat it as a lead rather than a recipe.',
};

const view = {
  filter: 'all',
  query: '',
  selectedId: null,
  data: null,
  store: null,
  lastRenderedId: null,
  pendingScroll: false,
};

let onSelectCallback = null;
let listWired = false;
let detailWired = false;
let filtersWired = false;

/* ------------------------------------------------------------------ utils */

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      default: return '&#39;';
    }
  });
}

/**
 * A [S#] chip that opens the Sources view on that row. The click is broadcast
 * rather than handled here, because only app.js knows how to change views.
 */
export function citeChip(id, extraClass = '') {
  return (
    `<button class="cite${extraClass ? ` ${extraClass}` : ''}" type="button" data-action="cite" ` +
    `data-source="${esc(id)}" title="Show ${esc(id)} in the Sources view">${esc(id)}</button>`
  );
}

export function citeChips(ids) {
  return (Array.isArray(ids) ? ids : []).map((id) => citeChip(id)).join('');
}

export function fmt(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString('en-US') : String(value ?? '');
}

function gradeIcon(grade, masked = false) {
  const key = GRADE_KEY[grade] ? grade : 'bronze';
  if (masked) {
    return '<span class="grade-icon grade-icon--masked" aria-hidden="true"><span>?</span></span>';
  }
  return `<span class="grade-icon grade-icon--${key}" aria-hidden="true"><span>${GRADE_KEY[key]}</span></span>`;
}

function badge(kind, text) {
  return `<span class="badge badge--${kind}">${esc(text)}</span>`;
}

function statusBadges(trophy) {
  const out = [];
  const missable = MISSABLE_BADGE[trophy.missable_status];
  if (missable) out.push(badge(missable[0], missable[1]));
  const method = METHOD_BADGE[trophy.method_status];
  if (method) out.push(badge(method[0], method[1]));
  return out;
}

function isMasked(trophy, store) {
  if (!store) return false;
  if (store.spoilersShown) return false;
  if (store.isEarned(trophy.id)) return false;
  if (store.isRevealed(trophy.id)) return false;
  return trophy.hidden === true || trophy.type === 'Story';
}

function byId(data, id) {
  return (data?.trophies ?? []).find((t) => t.id === Number(id)) ?? null;
}

function matchesQuery(trophy, query) {
  if (!query) return true;
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  if (trophy.name.toLowerCase().includes(needle)) return true;
  return needle === `#${trophy.id}` || needle === String(trophy.id);
}

function groupOf(trophy) {
  return GROUPS.find((g) => g.match(trophy)) ?? GROUPS[GROUPS.length - 1];
}

function visibleTrophies(data, store) {
  const filter = FILTERS.find((f) => f.key === view.filter) ?? FILTERS[0];
  return data.trophies
    .filter((t) => filter.test(t, store))
    .filter((t) => matchesQuery(t, view.query));
}

function defaultSelection(data, store) {
  const firstUnearned = data.trophies.find((t) => !store.isEarned(t.id));
  return (firstUnearned ?? data.trophies[0])?.id ?? null;
}

/* ---------------------------------------------------------------- filters */

export function renderFilters(container, data, state) {
  if (!container) return;
  const store = state.store;
  const frag = [];

  for (const filter of FILTERS) {
    const count = data.trophies.filter((t) => filter.test(t, store)).length;
    const active = filter.key === state.filter;
    frag.push(
      `<button class="pill${active ? ' is-active' : ''}" type="button" data-filter="${filter.key}" ` +
        `aria-pressed="${active}">${esc(filter.label)}<span class="pill__count">${count}</span></button>`,
    );
  }

  container.innerHTML = frag.join('');
  container.dataset.count = String(data.trophies.length);

  if (!filtersWired) {
    filtersWired = true;
    container.addEventListener('click', (event) => {
      const pill = event.target.closest('[data-filter]');
      if (!pill) return;
      view.filter = pill.dataset.filter;
      renderFilters(container, view.data, view);
      renderList(document.getElementById('trophy-list'), view.data, view, onSelectCallback);
    });
  }

  const search = document.getElementById('search');
  if (search) {
    if (search.value !== state.query) search.value = state.query;
    if (!search.dataset.wired) {
      search.dataset.wired = '1';
      search.addEventListener('input', () => {
        view.query = search.value;
        renderList(document.getElementById('trophy-list'), view.data, view, onSelectCallback);
      });
      search.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && search.value) {
          search.value = '';
          view.query = '';
          renderList(document.getElementById('trophy-list'), view.data, view, onSelectCallback);
        }
      });
    }
  }
}

/* ------------------------------------------------------------------- list */

function rowHtml(trophy, store, active) {
  const masked = isMasked(trophy, store);
  const earned = store.isEarned(trophy.id);
  const classes = ['trophy-row'];
  if (earned) classes.push('is-earned');
  if (active) classes.push('is-active');
  if (masked) classes.push('is-masked');

  const counter = trophy.counter
    ? `<span class="trophy-row__counter" title="Personal counter">${fmt(store.getCounter(trophy.id))}/${fmt(trophy.counter.target)}</span>`
    : '';

  const flags = masked
    ? '<button class="btn btn--tiny btn--ghost trophy-row__reveal" type="button" ' +
      `data-action="reveal" data-id="${trophy.id}">Reveal</button>`
    : `${statusBadges(trophy).join('')}${counter}`;

  const name = masked
    ? `<span class="trophy-row__name">${MASKED_NAME}</span>`
    : `<span class="trophy-row__name">${esc(trophy.name)}</span>`;

  const label = masked
    ? `<span class="trophy-row__label">${name}</span>`
    : `<span class="trophy-row__label"><span class="trophy-row__id">${trophy.id}</span>${name}</span>`;

  return (
    `<div class="${classes.join(' ')}" role="button" tabindex="0" data-action="select" ` +
    `data-id="${trophy.id}" aria-current="${active ? 'true' : 'false'}" ` +
    `aria-label="${esc(masked ? `${MASKED_NAME} ${trophy.id}` : `#${trophy.id} ${trophy.name}`)}">` +
    `<button class="trophy-row__check" type="button" data-action="toggle" data-id="${trophy.id}" ` +
    `aria-pressed="${earned}" aria-label="${earned ? 'Mark not earned' : 'Mark earned'}" ` +
    `title="${earned ? 'Earned — click to clear' : 'Click when earned'}"></button>` +
    `${gradeIcon(trophy.grade, masked)}` +
    label +
    `<span class="trophy-row__flags">${flags}</span>` +
    '</div>'
  );
}

export function renderList(container, data, state, onSelect) {
  if (!container) return;
  if (typeof onSelect === 'function') onSelectCallback = onSelect;
  const store = state.store;
  const rows = visibleTrophies(data, store);
  const scrollTop = container.scrollTop;

  const out = [];
  for (const group of GROUPS) {
    const inGroup = rows.filter((t) => groupOf(t) === group);
    if (inGroup.length === 0) continue;
    const earnedInGroup = inGroup.filter((t) => store.isEarned(t.id)).length;
    out.push(
      `<h3 class="group-head"><span>${esc(group.title)}</span>` +
        `<span class="group-head__count">${earnedInGroup}/${inGroup.length} earned</span></h3>`,
    );
    for (const trophy of inGroup) {
      out.push(rowHtml(trophy, store, trophy.id === state.selectedId));
    }
  }

  container.innerHTML = out.length
    ? out.join('')
    : '<p class="placeholder">Nothing matches that filter and search.</p>';
  container.scrollTop = scrollTop;

  const meta = document.getElementById('list-count');
  if (meta) {
    const suffix = rows.length === data.trophies.length ? 'all' : `${rows.length} shown`;
    meta.textContent = `${data.trophies.length} trophies · ${suffix}`;
  }

  if (!listWired) {
    listWired = true;
    container.addEventListener('click', (event) => {
      const check = event.target.closest('[data-action="toggle"]');
      if (check) {
        event.stopPropagation();
        view.store.toggleEarned(Number(check.dataset.id));
        return;
      }
      const reveal = event.target.closest('[data-action="reveal"]');
      if (reveal) {
        event.stopPropagation();
        view.store.reveal(Number(reveal.dataset.id));
        return;
      }
      const row = event.target.closest('[data-action="select"]');
      if (row) selectTrophy(Number(row.dataset.id));
    });
    container.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const row = event.target.closest('[data-action="select"]');
      if (!row || event.target !== row) return;
      event.preventDefault();
      selectTrophy(Number(row.dataset.id));
    });
  }

  if (state.pendingScroll) {
    state.pendingScroll = false;
    const active = container.querySelector('.trophy-row.is-active');
    if (active && typeof active.scrollIntoView === 'function') {
      active.scrollIntoView({ block: 'center' });
    }
  }
}

/* ----------------------------------------------------------------- detail */

function stepsHtml(trophy) {
  const steps = Array.isArray(trophy.steps) ? trophy.steps : [];
  if (steps.length === 0) return '<p class="placeholder">No steps recorded.</p>';
  const items = steps.map((step) => {
    const cites = citeChips(step.cite);
    return (
      `<li><span class="steps__text">${esc(step.text)}</span>` +
      `<span class="steps__cites">${cites}</span></li>`
    );
  });
  return `<ol class="steps">${items.join('')}</ol>`;
}

function disagreeHtml(entries) {
  return (Array.isArray(entries) ? entries : [])
    .map((entry) => {
      const sides = (Array.isArray(entry.sides) ? entry.sides : [])
        .map(
          (side) =>
            `<li class="disagree__side"><span class="disagree__source">${esc(side.source)}</span>` +
            `<span>${esc(side.claim)}</span></li>`,
        )
        .join('');
      const call = entry.call
        ? `<p class="disagree__call">${esc(entry.call)}</p>`
        : '';
      return (
        '<div class="disagree">' +
        '<p class="disagree__head">Sources disagree</p>' +
        `<p class="disagree__topic">${esc(entry.topic)}</p>` +
        `<ul class="disagree__sides">${sides}</ul>${call}</div>`
      );
    })
    .join('');
}

function counterHtml(trophy, store) {
  if (!trophy.counter) return '';
  const target = Number(trophy.counter.target) || 0;
  const value = store.getCounter(trophy.id);
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  const unit = trophy.counter.unit ?? 'total';
  return (
    '<div class="detail__section">' +
    '<h3>Your counter</h3>' +
    '<div class="counter">' +
    '<span class="counter__label">Progress</span>' +
    `<button class="btn btn--tiny" type="button" data-action="counter-dec" data-id="${trophy.id}" ` +
    'aria-label="One fewer">&minus;</button>' +
    `<span class="counter__value" data-counter-value>${fmt(value)}</span>` +
    `<button class="btn btn--tiny" type="button" data-action="counter-inc" data-id="${trophy.id}" ` +
    'aria-label="One more">+</button>' +
    `<span class="counter__unit">of ${fmt(target)} ${esc(unit)}</span>` +
    `<span class="counter__bar" aria-hidden="true"><span class="counter__fill" style="width:${pct.toFixed(1)}%"></span></span>` +
    '</div></div>'
  );
}

function statusHtml(trophy) {
  const lines = [];
  const missable = MISSABLE_NOTE[trophy.missable_status];
  if (missable) {
    lines.push(
      '<p class="status-line"><span class="status-line__key">Missable</span>' +
        `<span>${esc(missable)}</span></p>`,
    );
  } else {
    lines.push(
      '<p class="status-line"><span class="status-line__key">Missable</span>' +
        '<span>No: the sources put it in reach after the story, with the Chapter 1 question below as the only exception.</span></p>',
    );
  }
  const method = METHOD_NOTE[trophy.method_status];
  if (method) {
    lines.push(
      '<p class="status-line"><span class="status-line__key">Method</span>' +
        `<span>${esc(method)}</span></p>`,
    );
  }
  return `<div class="detail__section"><h3>Status</h3>${lines.join('')}</div>`;
}

function missableCallout(trophy) {
  if (trophy.missable_status === 'none') return '';
  return (
    '<div class="callout">' +
    '<p class="callout__head">Point of no return — Chapter 1</p>' +
    '<p>After <em>Down to Earth</em>, Lucia says she is going to meditate at Jason\'s house. ' +
    'Follow her to the balcony and accept. That session raises the progress counter without being ' +
    'flagged as a Meditation Spot, so whether the trophy needs it is still unclear — do it anyway, ' +
    'and keep a Chapter 1 save, because there is no mission replay.</p>' +
    '</div>'
  );
}

function detailHtml(trophy, store) {
  const badges = statusBadges(trophy).join('');
  const earned = store.isEarned(trophy.id);
  const short = trophy.guide_short ? esc(trophy.guide_short) : 'No short summary recorded.';

  return (
    '<div class="detail__top">' +
    '<div>' +
    `<p class="detail__id">#${trophy.id} · ${esc(GRADE_LABEL[trophy.grade] ?? trophy.grade)} · ${esc(trophy.type)}</p>` +
    `<h2 class="detail__name">${esc(trophy.name)}</h2>` +
    `<div class="detail__badges">${gradeIcon(trophy.grade)}${badges}</div>` +
    '</div>' +
    '<div class="detail__earn">' +
    `<button class="btn btn--tiny${earned ? ' btn--earned' : ''}" type="button" data-action="earn" ` +
    `data-id="${trophy.id}" aria-pressed="${earned}">${earned ? 'Earned ✓' : 'Mark earned'}</button>` +
    '</div>' +
    '</div>' +
    '<p class="detail__official"><span>Official description</span>' +
    `“${esc(trophy.description)}”</p>` +
    `<div class="detail__section"><h3>In short</h3><p class="detail__short">${short}</p></div>` +
    `<div class="detail__section"><h3>How to get it</h3>${stepsHtml(trophy)}</div>` +
    disagreeHtml(trophy.disagree) +
    missableCallout(trophy) +
    statusHtml(trophy) +
    counterHtml(trophy, store)
  );
}

function shieldHtml(trophy, store) {
  const note = trophy.type === 'Story'
    ? 'Story trophy: its name and guide stay masked until you earn it.'
    : 'Hidden trophy: its name and guide stay masked until you earn it.';
  return (
    '<div class="shield">' +
    `<p class="shield__title">${MASKED_NAME}</p>` +
    `<p class="shield__note">${esc(note)} Reveal this one, tick it as earned, or turn spoilers on for the whole list.</p>` +
    `<button class="btn" type="button" data-action="reveal" data-id="${trophy.id}">Reveal this trophy</button>` +
    '</div>'
  );
}

function renderTrophySources(container, trophy, data) {
  if (!container) return;
  if (!trophy) {
    container.innerHTML = '<p class="placeholder">Pick a trophy.</p>';
    return;
  }
  const index = new Map((data?.sources ?? []).map((s) => [s.id, s]));
  const used = [];
  for (const step of Array.isArray(trophy.steps) ? trophy.steps : []) {
    for (const id of Array.isArray(step.cite) ? step.cite : []) {
      if (!used.includes(id)) used.push(id);
    }
  }
  if (used.length === 0) {
    container.innerHTML = '<p class="placeholder">No source cited for this trophy.</p>';
    return;
  }
  const cards = used
    .map((id) => {
      const source = index.get(id);
      if (!source) {
        return `<div class="source-mini"><span class="source-mini__id">${esc(id)}</span>` +
          '<span class="source-mini__name">Not in the source index</span></div>';
      }
      return (
        '<div class="source-mini">' +
        `<span class="source-mini__id">${esc(source.id)}</span>` +
        `<span class="source-mini__name">${esc(source.name)}</span>` +
        `<span class="source-mini__meta">${esc(source.date ?? '')}</span>` +
        `<p class="source-mini__carried">${esc(source.carried ?? '')}</p>` +
        '</div>'
      );
    })
    .join('');
  container.innerHTML =
    `<p class="source-mini__meta">${used.length} of ${(data?.sources ?? []).length} sources cited here</p>` +
    cards;
}

export function renderDetail(panel, trophy, state) {
  if (!panel) return;
  const store = state.store;
  const scrollTop = panel.scrollTop;
  const sourcesPanel = document.getElementById('trophy-sources');

  if (!trophy) {
    panel.innerHTML = '<p class="placeholder">Pick a trophy from the list.</p>';
    if (sourcesPanel) sourcesPanel.innerHTML = '<p class="placeholder">—</p>';
    return;
  }

  if (isMasked(trophy, store)) {
    panel.innerHTML = shieldHtml(trophy, store);
    if (sourcesPanel) {
      sourcesPanel.innerHTML =
        '<p class="placeholder">The sources for this trophy are listed once it is revealed.</p>';
    }
  } else {
    panel.innerHTML = detailHtml(trophy, store);
    renderTrophySources(sourcesPanel, trophy, state.data);
  }

  if (state.lastRenderedId === trophy.id) panel.scrollTop = scrollTop;
  else panel.scrollTop = 0;
  state.lastRenderedId = trophy.id;

  if (!detailWired) {
    detailWired = true;
    panel.addEventListener('click', (event) => {
      const action = event.target.closest('[data-action]');
      if (!action) return;
      const id = Number(action.dataset.id);
      switch (action.dataset.action) {
        case 'earn':
          view.store.toggleEarned(id);
          break;
        case 'reveal':
          view.store.reveal(id);
          break;
        case 'cite': {
          document.dispatchEvent(
            new CustomEvent('leonida:cite', { detail: { source: action.dataset.source } }),
          );
          break;
        }
        case 'counter-inc':
        case 'counter-dec': {
          const current = view.store.getCounter(id);
          const target = byId(view.data, id)?.counter?.target ?? Infinity;
          const step = Number(action.dataset.step ?? 1);
          const next = action.dataset.action === 'counter-inc' ? current + step : current - step;
          view.store.setCounter(id, next, target);
          break;
        }
        default:
          break;
      }
    });
  }
}

/* ------------------------------------------------------------------ entry */

export function selectTrophy(id) {
  const n = Number(id);
  if (!Number.isFinite(n)) return;
  view.selectedId = n;
  view.pendingScroll = true;
  if (view.data && view.store) {
    renderList(document.getElementById('trophy-list'), view.data, view, onSelectCallback);
    renderDetail(document.getElementById('trophy-detail'), byId(view.data, n), view);
  }
}

export function currentTrophy() {
  return byId(view.data, view.selectedId);
}

export function renderTracker({ doc, store, focusId }) {
  view.data = doc;
  view.store = store;

  if (focusId != null && byId(doc, focusId)) {
    view.selectedId = Number(focusId);
    view.pendingScroll = true;
  }
  if (view.selectedId == null || !byId(doc, view.selectedId)) {
    view.selectedId = defaultSelection(doc, store);
  }

  renderFilters(document.getElementById('filters'), doc, view);
  renderList(document.getElementById('trophy-list'), doc, view, (id) => selectTrophy(id));
  renderDetail(document.getElementById('trophy-detail'), byId(doc, view.selectedId), view);
}
