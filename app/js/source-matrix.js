// The Sources view: one row per source, with the number of the 55 guides that
// cite it worked out from the steps themselves rather than from a list someone
// typed, and then the collected disagreements — both sides, each attributed,
// with the call we made.
//
// A citation chip anywhere in the app opens this view and asks for a row, so
// the module keeps the element it last drew and can flash a row without a
// re-render.

import { esc } from './guide-render.js';

let lastRoot = null;

function citationCounts(data) {
  const counts = new Map();
  for (const trophy of data.trophies) {
    const seen = new Set();
    for (const step of Array.isArray(trophy.steps) ? trophy.steps : []) {
      for (const id of Array.isArray(step.cite) ? step.cite : []) {
        if (!seen.has(id)) {
          seen.add(id);
          counts.set(id, (counts.get(id) ?? 0) + 1);
        }
      }
    }
  }
  return counts;
}

function matrixHtml(data) {
  const counts = citationCounts(data);
  const total = data.trophies.length;
  const rows = (Array.isArray(data.sources) ? data.sources : [])
    .map((source) => {
      const cited = counts.get(source.id) ?? 0;
      const width = total > 0 ? Math.round((cited / total) * 100) : 0;
      return (
        `<tr data-source-row="${esc(source.id)}" id="source-${esc(source.id)}">` +
        `<td><span class="matrix__id">${esc(source.id)}</span></td>` +
        `<td><span class="matrix__name">${esc(source.name)}</span></td>` +
        `<td>${esc(source.date ?? '—')}</td>` +
        `<td>${esc(source.carried ?? '')}</td>` +
        `<td class="num">${cited}<span class="matrix__of">/${total}</span>` +
        `<span class="matrix__bar" aria-hidden="true"><span style="width:${width}%"></span></span></td>` +
        '</tr>'
      );
    })
    .join('');

  return (
    '<div class="table-wrap"><table class="matrix">' +
    '<caption class="matrix__caption">Thirteen sources read for this list. The last column counts how many ' +
    'of the ' + total + ' trophy guides cite each one, worked out from the steps in the data.</caption>' +
    '<thead><tr><th>ID</th><th>Source</th><th>Its date</th><th>What it carried</th><th>Cited by</th></tr></thead>' +
    `<tbody>${rows}</tbody></table></div>`
  );
}

function disagreementHtml(entry) {
  const sides = (Array.isArray(entry.sides) ? entry.sides : [])
    .map(
      (side) =>
        `<li class="disagree__side"><span class="disagree__source">${esc(side.source)}</span>` +
        `<span>${esc(side.claim)}</span></li>`,
    )
    .join('');
  const call = entry.call ? `<p class="disagree__call">${esc(entry.call)}</p>` : '';
  return (
    '<li class="disagree-card">' +
    `<p class="disagree-card__topic">${esc(entry.topic)}</p>` +
    `<ul class="disagree__sides">${sides}</ul>${call}</li>`
  );
}

export function renderSources(el, data) {
  if (!el) return;
  lastRoot = el;
  const disagreements = Array.isArray(data.disagreements) ? data.disagreements : [];
  const sources = Array.isArray(data.sources) ? data.sources : [];
  const inline = data.trophies.filter((t) => Array.isArray(t.disagree) && t.disagree.length > 0);

  el.innerHTML =
    '<div class="view-head">' +
    '<h2>Where every fact came from</h2>' +
    `<p>${sources.length} sources · ${disagreements.length} collected disagreements</p>` +
    '</div>' +
    '<p class="roadmap-lede">' +
    'Each of the ' + data.trophies.length + ' guides was written from these sources, and every step names the ' +
    'one behind it. Where they contradict each other the contradiction is kept rather than smoothed over: ' +
    'the list below shows both sides, and what we decided to print.' +
    '</p>' +
    matrixHtml(data) +
    '<div class="view-head view-head--sub"><h2>Disagreements, both sides</h2>' +
    `<p>${disagreements.length} collected` +
    (inline.length ? ` · also shown inline on ${inline.map((t) => `#${t.id}`).join(', ')}` : '') +
    '</p></div>' +
    '<ul class="disagree-list">' +
    (disagreements.length
      ? disagreements.map(disagreementHtml).join('')
      : '<li class="placeholder">No disagreements recorded.</li>') +
    '</ul>' +
    '<p class="source-note">Counts in the last column are per guide, not per step: a trophy that cites the ' +
    'same source on three steps still counts once. The bar beside each count is that share of the full ' +
    'trophy list.</p>';
}

/** Flashes one row of the matrix, for a citation chip clicked elsewhere. */
export function focusSource(id) {
  if (!lastRoot) return false;
  const row = lastRoot.querySelector(`[data-source-row="${CSS.escape(String(id))}"]`);
  if (!row) return false;
  row.scrollIntoView({ block: 'center', behavior: 'smooth' });
  row.classList.remove('is-flash');
  // Reflow between the class removals so a second click re-runs the animation.
  void row.offsetWidth;
  row.classList.add('is-flash');
  setTimeout(() => row.classList.remove('is-flash'), 1800);
  return true;
}
