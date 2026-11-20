// Progress state for Leonida 55. Deliberately knows nothing about the trophy
// list: it stores ids, counter values and reveal flags, and leaves the meaning
// of those ids to the modules that render them. Everything stays in this
// browser's localStorage; the only way state leaves the machine is the export
// button, which hands the caller a JSON string.

export const STORAGE_KEY = 'leonida55.progress.v1';
export const STATE_VERSION = 1;

const listeners = new Set();

function emptyState() {
  return {
    version: STATE_VERSION,
    earned: [],
    counters: {},
    revealed: [],
    spoilers: false,
    updatedAt: null,
  };
}

function toInt(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function uniqueIds(list) {
  const seen = new Set();
  const out = [];
  for (const raw of Array.isArray(list) ? list : []) {
    const id = toInt(raw);
    if (id !== null && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out.sort((a, b) => a - b);
}

function cleanCounters(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [key, value] of Object.entries(raw)) {
    const id = toInt(key);
    const n = Number(value);
    if (id === null || !Number.isFinite(n) || n <= 0) continue;
    out[id] = Math.floor(n);
  }
  return out;
}

// Accepts our own export shape, plus a bare array of ids for the case where
// someone hand-writes a file from an older checklist.
function normalise(input) {
  if (Array.isArray(input)) {
    return { ...emptyState(), earned: uniqueIds(input) };
  }
  if (!input || typeof input !== 'object') {
    throw new Error('That file is not a Leonida 55 progress export.');
  }
  if (!('earned' in input) && !('counters' in input)) {
    throw new Error('That file has no earned trophies in it.');
  }
  return {
    version: STATE_VERSION,
    earned: uniqueIds(input.earned),
    counters: cleanCounters(input.counters),
    revealed: uniqueIds(input.revealed),
    spoilers: input.spoilers === true,
    updatedAt: typeof input.updatedAt === 'string' ? input.updatedAt : null,
  };
}

export function createStore() {
  let state = emptyState();
  let hasChanged = false;
  let storageWorks = true;

  function readStorage() {
    let raw = null;
    try {
      raw = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      storageWorks = false;
      return null;
    }
    if (!raw) return null;
    try {
      return normalise(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  function persist() {
    if (!storageWorks) return false;
    state.updatedAt = new Date().toISOString();
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      hasChanged = true;
      return true;
    } catch {
      storageWorks = false;
      return false;
    }
  }

  function emit() {
    for (const fn of listeners) {
      try {
        fn(store);
      } catch (error) {
        console.error('listener failed', error);
      }
    }
  }

  function commit() {
    persist();
    emit();
  }

  function setState(next, { save = true } = {}) {
    state = next;
    if (save) commit();
    else emit();
  }

  const stored = readStorage();
  if (stored) {
    state = stored;
    hasChanged = true;
  }

  const store = {
    /** True once this browser holds progress worth showing as saved. */
    get hasChanged() {
      return hasChanged;
    },

    get storageAvailable() {
      return storageWorks;
    },

    get spoilersShown() {
      return state.spoilers;
    },

    get updatedAt() {
      return state.updatedAt;
    },

    /** Snapshot of the ids, sorted ascending. */
    earnedIds() {
      return state.earned.slice();
    },

    revealedIds() {
      return state.revealed.slice();
    },

    isEarned(id) {
      return state.earned.includes(Number(id));
    },

    setEarned(id, earned = true) {
      const n = toInt(id);
      if (n === null) return;
      const has = state.earned.includes(n);
      if (earned === has) return;
      const next = state.earned.slice();
      if (earned) next.push(n);
      else next.splice(next.indexOf(n), 1);
      state = { ...state, earned: next.sort((a, b) => a - b) };
      commit();
    },

    toggleEarned(id) {
      this.setEarned(id, !this.isEarned(id));
    },

    getCounter(id) {
      return state.counters[Number(id)] ?? 0;
    },

    counters() {
      return { ...state.counters };
    },

    setCounter(id, value, max = Infinity) {
      const n = toInt(id);
      if (n === null) return;
      let v = Math.floor(Number(value));
      if (!Number.isFinite(v)) v = 0;
      v = Math.max(0, Math.min(v, Number.isFinite(max) ? max : v));
      if (this.getCounter(n) === v) return;
      const next = { ...state.counters };
      if (v === 0) delete next[n];
      else next[n] = v;
      state = { ...state, counters: next };
      commit();
    },

    isRevealed(id) {
      return state.revealed.includes(Number(id));
    },

    reveal(id) {
      const n = toInt(id);
      if (n === null || state.revealed.includes(n)) return;
      state = { ...state, revealed: state.revealed.concat(n).sort((a, b) => a - b) };
      commit();
    },

    conceal(id) {
      const n = toInt(id);
      if (!state.revealed.includes(n)) return;
      state = { ...state, revealed: state.revealed.filter((x) => x !== n) };
      commit();
    },

    toggleReveal(id) {
      if (this.isRevealed(id)) this.conceal(id);
      else this.reveal(id);
    },

    setSpoilersShown(shown) {
      const next = shown === true;
      if (state.spoilers === next) return;
      state = { ...state, spoilers: next };
      commit();
    },

    /** JSON text for the export download. */
    exportState() {
      const payload = {
        app: 'Leonida 55',
        version: STATE_VERSION,
        exportedAt: new Date().toISOString(),
        earned: state.earned.slice(),
        counters: { ...state.counters },
        revealed: state.revealed.slice(),
        spoilers: state.spoilers,
      };
      return JSON.stringify(payload, null, 2);
    },

    /** Applies a parsed-or-text export; throws with a readable message. */
    importState(text) {
      let parsed;
      try {
        parsed = typeof text === 'string' ? JSON.parse(text) : text;
      } catch {
        throw new Error('That file is not valid JSON.');
      }
      const next = normalise(parsed);
      setState(next);
      return {
        earned: next.earned.length,
        counters: Object.keys(next.counters).length,
      };
    },

    clear() {
      state = emptyState();
      hasChanged = false;
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        storageWorks = false;
      }
      emit();
    },

    /** Replaces state wholesale without touching localStorage semantics. */
    replace(nextState) {
      setState(normalise(nextState));
    },

    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    notify() {
      emit();
    },
  };

  return store;
}
