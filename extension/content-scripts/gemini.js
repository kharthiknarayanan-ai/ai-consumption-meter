// Detects completed model responses on gemini.google.com and reports their
// length to the background worker.
//
// Confirmed via live DOM inspection (2026-07-25): Gemini's web app renders
// each reply inside a dedicated custom element, <model-response>, distinct
// from <user-query> for the user's own turns. Unlike Claude, no exclusion
// logic is needed — the tag itself only ever wraps assistant replies.
//
// NOTE ON FRAGILITY: still tied to Gemini's current markup. If events stop
// appearing, open DevTools on gemini.google.com, send a message, and in the
// Console run:
//   [...new Set([...document.querySelectorAll('*')].map(el => el.tagName.toLowerCase()).filter(t => t.includes('-')))]
// to see what custom elements exist now, and update SELECTOR below.
// CATEGORY HEURISTIC: replies at or above DELEGATED_CREATION_MIN_LEN chars
// are logged as 'delegated_creation' instead of 'direct_query' — a
// length-based proxy for "this was drafted content, not a quick question."
(function () {
  const PLATFORM = 'gemini';
  const SELECTOR = 'model-response';
  const SETTLE_MS = 1500;
  const DELEGATED_CREATION_MIN_LEN = 800;

  const settleTimers = new WeakMap();

  function classifyCategory(length) {
    return length >= DELEGATED_CREATION_MIN_LEN ? 'delegated_creation' : 'direct_query';
  }

  function reportEvent(node) {
    if (node.dataset.aicmLogged === '1') return;
    const text = (node.textContent || '').trim();
    if (!text) return;

    // In-page guard only; persistent fingerprint dedup lives in AICM.report.
    node.dataset.aicmLogged = '1';
    AICM.report({ platform: PLATFORM, text, category: classifyCategory(text.length) });
  }

  function scheduleSettleCheck(node) {
    if (node.dataset.aicmLogged === '1') return;
    if (settleTimers.has(node)) clearTimeout(settleTimers.get(node));
    const timer = setTimeout(() => reportEvent(node), SETTLE_MS);
    settleTimers.set(node, timer);
  }

  function scan(root) {
    if (!root.querySelectorAll) return;
    root.querySelectorAll(SELECTOR).forEach((node) => scheduleSettleCheck(node));
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType !== 1) return;
        if (node.matches && node.matches(SELECTOR)) scheduleSettleCheck(node);
        scan(node);
      });
      // Streaming responses mutate text inside an already-added node —
      // re-arm the settle timer for whichever response element changed.
      if (mutation.target && mutation.target.closest) {
        const container = mutation.target.closest(SELECTOR);
        if (container) scheduleSettleCheck(container);
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true, characterData: true });

  // Catch replies already on the page at load (e.g. navigating into an existing chat).
  scan(document.body);

  // Local-only breakage detection — see lib/aicm-report.js.
  AICM.recordVisit(PLATFORM);
})();
