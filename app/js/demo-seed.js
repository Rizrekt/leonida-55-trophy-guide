// Deterministic demo state for screenshots and for anyone who wants to see the
// tracker with a life in it. Eleven bronze trophies, spread across the list so
// the grouping is visible, plus a part-finished meditation counter on #28.
// Only ever applied when the URL carries demo=1.

export const DEMO_EARNED = [2, 3, 8, 16, 20, 21, 33, 35, 36, 47, 53];

export const DEMO_COUNTERS = { 28: 6 };

export const DEMO_FOCUS_ID = 28;

/** True when the page was opened with ?demo=1. */
export function demoRequested(search = window.location.search) {
  try {
    return new URLSearchParams(search).get('demo') === '1';
  } catch {
    return false;
  }
}

/**
 * Writes the demo state straight into the store. Idempotent: running it twice
 * leaves exactly the same state behind.
 */
export function applyDemo(store) {
  const demo = {
    version: 1,
    earned: DEMO_EARNED.slice(),
    counters: { ...DEMO_COUNTERS },
    revealed: [],
    spoilers: false,
    updatedAt: new Date().toISOString(),
  };
  store.replace(demo);
  return demo;
}
