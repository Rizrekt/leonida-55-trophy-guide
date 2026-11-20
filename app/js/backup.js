// Two things live here: the Progress & backup panel that sits under the
// Missables view, and the Missables view itself.
//
// The backup panel deliberately re-uses the header's export and import
// functions rather than re-implementing them — there is one download path and
// one file-reading path in the app, and this panel is a second door onto it.
// It also owns the one destructive action in the app (clearing progress), so
// it asks before doing it.

import { esc, fmt, citeChips } from './guide-render.js';

const MISSABLE_LABEL = {
  'possibly-unconfirmed': ['missable', 'Possibly missable — unconfirmed'],
  confirmed: ['missable', 'Missable'],
};

const METHOD_LABEL = {
  'partly-confirmed': ['method', 'Partly confirmed'],
  'to-be-confirmed': ['method', 'Method to be confirmed'],
  inferred: ['method', 'Inferred'],
};

function badge(kind, text) {
  return `<span class="badge badge--${kind}">${esc(text)}</span>`;
}

function trophyLink(trophy, extra = '') {
  return (
    `<button class="link-row" type="button" data-action="jump" data-id="${trophy.id}">` +
    `<span class="link-row__id">#${trophy.id}</span>` +
    `<span class="link-row__name">${esc(trophy.name)}</span>` +
    (extra ? `<span class="link-row__extra">${extra}</span>` : '') +
    '</button>'
  );
}

/* ---------------------------------------------------------- backup panel */

let backupWired = false;
let confirmTimer = 0;

/**
 * @param {HTMLElement} el
 * @param {object} store
 * @param {{total: number, onExport: Function, onImport: Function, onReset: Function}} handlers
 */
export function renderBackup(el, store, handlers = {}) {
  if (!el) return;
  const total = Number(handlers.total) || 0;
  const earned = store.earnedIds().length;
  const counters = Object.keys(store.counters()).length;
  const revealed = store.revealedIds().length;
  const saved = store.hasChanged && store.storageAvailable;

  el.innerHTML =
    '<p class="backup__text">' +
    `<strong>${earned}${total ? ` of ${total}` : ''}</strong> earned` +
    (counters ? ` · ${counters} counter${counters === 1 ? '' : 's'} in progress` : '') +
    (revealed ? ` · ${revealed} revealed by hand` : '') +
    '. ' +
    (saved
      ? 'Progress is written to this browser as you tick trophies.'
      : store.storageAvailable
        ? 'Nothing saved in this browser yet — tick a trophy or import a file.'
        : 'This browser is blocking storage, so export a file if you want to keep progress.') +
    '</p>' +
    '<div class="backup__actions">' +
    '<button class="btn" type="button" data-action="backup-export">Export progress</button>' +
    '<button class="btn" type="button" data-action="backup-import">Import a file</button>' +
    '<button class="btn btn--ghost" type="button" data-action="backup-reset">Reset progress</button>' +
    '<input type="file" accept="application/json,.json" data-backup-file hidden>' +
    '</div>' +
    '<p class="backup__msg" data-backup-msg role="status" aria-live="polite"></p>';

  if (!backupWired) {
    backupWired = true;
    // The panel is re-drawn on every progress change, so a message node is
    // looked up at the moment it is written rather than captured up front.
    const say = (text, tone = 'info') =>
      setBackupMessage(el.querySelector('[data-backup-msg]'), text, tone);

    el.addEventListener('click', (event) => {
      const action = event.target.closest('[data-action]');
      if (!action) return;
      const fileInput = el.querySelector('[data-backup-file]');

      switch (action.dataset.action) {
        case 'backup-export':
          handlers.onExport?.();
          say('Exported to a file in your downloads.');
          break;
        case 'backup-import':
          fileInput?.click();
          break;
        case 'backup-reset': {
          if (action.dataset.armed !== '1') {
            action.dataset.armed = '1';
            action.textContent = 'Click again to reset';
            action.classList.add('is-armed');
            say('Resetting clears every tick and counter in this browser. Click again to confirm.');
            clearTimeout(confirmTimer);
            confirmTimer = setTimeout(() => {
              const live = el.querySelector('[data-action="backup-reset"]');
              if (!live) return;
              live.dataset.armed = '0';
              live.textContent = 'Reset progress';
              live.classList.remove('is-armed');
            }, 6000);
            return;
          }
          clearTimeout(confirmTimer);
          action.dataset.armed = '0';
          action.textContent = 'Reset progress';
          action.classList.remove('is-armed');
          handlers.onReset?.();
          say('Progress cleared.');
          break;
        }
        default:
          break;
      }
    });

    el.addEventListener('change', (event) => {
      const input = event.target.closest('[data-backup-file]');
      if (!input) return;
      const file = input.files?.[0];
      if (!file) return;
      Promise.resolve(handlers.onImport?.(file))
        .then((text) => {
          if (text) say(text, text.startsWith('Imported') ? 'info' : 'error');
        })
        .catch((error) => say(error.message ?? 'Import failed.', 'error'))
        .finally(() => { input.value = ''; });
    });
  }
}

function setBackupMessage(node, text, tone = 'info') {
  if (!node) return;
  node.textContent = text;
  node.dataset.tone = tone;
  clearTimeout(node.dataset.timer);
  if (text) {
    const timer = setTimeout(() => { node.textContent = ''; }, 5000);
    node.dataset.timer = String(timer);
  }
}

/* --------------------------------------------------------------- missables */

function missableCard(trophy, data) {
  const missable = MISSABLE_LABEL[trophy.missable_status];
  const method = METHOD_LABEL[trophy.method_status];
  const badges = [missable ? badge(...missable) : '', method ? badge(...method) : ''].join(' ');
  const chapterSteps = (Array.isArray(trophy.steps) ? trophy.steps : []).filter((step) =>
    /chapter 1|balcony|down to earth/i.test(step.text),
  );
  const summary = chapterSteps.length
    ? `<ul class="missable-item__steps">${chapterSteps
        .map(
          (step) =>
            `<li><span>${esc(step.text)}</span>` +
            `<span class="steps__cites">${citeChips(step.cite)}</span></li>`,
        )
        .join('')}</ul>`
    : '';

  const disagree = (Array.isArray(trophy.disagree) ? trophy.disagree : [])
    .map((entry) => {
      const sides = (Array.isArray(entry.sides) ? entry.sides : [])
        .map(
          (side) =>
            `<li class="disagree__side"><span class="disagree__source">${esc(side.source)}</span>` +
            `<span>${esc(side.claim)}</span></li>`,
        )
        .join('');
      return (
        '<div class="disagree">' +
        `<p class="disagree__head">Sources disagree</p>` +
        `<p class="disagree__topic">${esc(entry.topic)}</p>` +
        `<ul class="disagree__sides">${sides}</ul>` +
        (entry.call ? `<p class="disagree__call">${esc(entry.call)}</p>` : '') +
        '</div>'
      );
    })
    .join('');

  return (
    '<div class="missable-item">' +
    '<div class="missable-item__head">' +
    `<h3 class="missable-item__name">#${trophy.id} ${esc(trophy.name)}</h3>` +
    `<span class="missable-item__badges">${badges}</span>` +
    '</div>' +
    `<p class="missable-item__desc">${esc(trophy.description)}</p>` +
    '<p class="missable-item__short">' +
    'One trophy carries a real warning and it is this one. Both guide sources say the Chapter 1 ' +
    'meditation may matter and that nobody has confirmed it; the third says there are no missables at ' +
    'all. The cost of doing it anyway is a minute, so the label stays cautious.' +
    '</p>' +
    summary +
    disagree +
    `<div class="missable-item__foot">${trophyLink(trophy, 'Open the full guide')}</div>` +
    '</div>'
  );
}

function watchSection(data, store) {
  const partly = data.trophies.filter((t) => t.method_status === 'partly-confirmed');
  const open = data.trophies.filter((t) => t.method_status === 'to-be-confirmed');
  const inferred = data.trophies.filter((t) => t.method_status === 'inferred');

  const rows = (list, label) =>
    list
      .map(
        (trophy) =>
          `<div class="watch-item">` +
          `<span class="watch-item__label">${esc(label)}</span>` +
          `<span class="watch-item__text">${esc(trophy.guide_short ?? trophy.description)}</span> ` +
          `<button class="btn btn--tiny btn--ghost" type="button" data-action="jump" data-id="${trophy.id}">` +
          `#${trophy.id} ${esc(trophy.name)}</button>` +
          (store.isEarned(trophy.id) ? '<span class="badge badge--ok">Earned</span>' : '') +
          '</div>',
      )
      .join('');

  return (
    '<section class="view-sub">' +
    '<div class="view-head view-head--sub"><h2>On the watch list</h2>' +
    `<p>${partly.length + open.length + inferred.length} trophies with an open method</p></div>` +
    '<p class="roadmap-lede">' +
    'These are not missables — everything below is still doable after the story. What is unsettled is ' +
    'the <em>method</em>: the sources name the trophy and its official description, but not the full ' +
    'route. Each guide says so plainly rather than inventing steps, and the tracker repeats the label.' +
    '</p>' +
    (partly.length
      ? '<h3 class="watch-head">Partly confirmed — one detail still open</h3>' + rows(partly, 'Partly confirmed')
      : '') +
    (open.length
      ? '<h3 class="watch-head">Method to be confirmed — no route published yet</h3>' +
        rows(open, 'Method to be confirmed')
      : '') +
    (inferred.length
      ? '<h3 class="watch-head">Inferred from the description only</h3>' + rows(inferred, 'Inferred')
      : '') +
    '</section>'
  );
}

export function renderMissables(el, data, store, onSelect) {
  if (!el) return;
  const missables = data.trophies.filter((t) => t.missable_status !== 'none');
  const nothingMissed = data.trophies.length - missables.length;

  el.innerHTML =
    '<div class="view-head">' +
    '<h2>Missables &amp; the watch list</h2>' +
    `<p>${missables.length} possibly missable · ${data.trophies.length - nothingMissed} of ${data.trophies.length} safe after the story</p>` +
    '</div>' +
    '<p class="roadmap-lede">' +
    `Nothing on the ${data.trophies.length}-trophy list is a confirmed missable. One trophy is flagged as ` +
    'possibly missable and unconfirmed, and a handful have a method the sources have not finished ' +
    'pinning down. This view collects both so you can decide what to do early rather than read about ' +
    'it afterwards.' +
    '</p>' +
    '<section class="view-sub">' +
    '<div class="view-head view-head--sub"><h2>Potentially missable</h2>' +
    `<p>${missables.length} flagged</p></div>` +
    (missables.length
      ? missables.map((t) => missableCard(t, data)).join('')
      : '<p class="placeholder">No trophy carries a missable flag.</p>') +
    '</section>' +
    watchSection(data, store);

  if (!el.dataset.wired) {
    el.dataset.wired = '1';
    el.addEventListener('click', (event) => {
      const jump = event.target.closest('[data-action="jump"]');
      if (jump) {
        event.preventDefault();
        onSelect?.(Number(jump.dataset.id));
        return;
      }
      const cite = event.target.closest('[data-action="cite"]');
      if (cite) {
        document.dispatchEvent(
          new CustomEvent('leonida:cite', { detail: { source: cite.dataset.source } }),
        );
      }
    });
  }
}
