// Detects completed assistant responses on claude.ai and reports their length
// to the background worker.
//
// Confirmed via live DOM inspection (2026-07-25): every chat turn (user or
// assistant) is wrapped in an element whose class includes "message-row".
// User turns additionally contain a [data-testid="user-message"] node;
// assistant turns don't. So: match ROW_SELECTOR, then skip any row that
// contains USER_MARKER_SELECTOR — whatever's left is Claude's reply.
//
// NOTE ON FRAGILITY: this is still tied to Claude's current markup. If
// events stop appearing, open DevTools on claude.ai, send a message, and in
// the Console run:
//   [...document.querySelectorAll('[data-testid]')].map(el => el.dataset.testid)
// to see what testids exist now, and adjust the selectors below.
// CATEGORY HEURISTIC: replies at or above DELEGATED_CREATION_MIN_LEN chars
// are logged as 'delegated_creation' instead of 'direct_query' — a
// length-based proxy for "this was drafted content, not a quick question."
(function () {
  const PLATFORM = 'claude';
  const ROW_SELECTOR = '[class*="message-row"]';
  const USER_MARKER_SELECTOR = '[data-testid="user-message"]';
  const SETTLE_MS = 1500;
  const DELEGATED_CREATION_MIN_LEN = 800;

  const settleTimers = new WeakMap();

  function isAssistantRow(node) {
    return node.matches && node.matches(ROW_SELECTOR) && !node.querySelector(USER_MARKER_SELECTOR);
  }

  function classifyCategory(length) {
    return length >= DELEGATED_CREATION_MIN_LEN ? 'delegated_creation' : 'direct_query';
  }

  function reportEvent(node) {
    if (node.dataset.aicmLogged === '1') return;
    // Re-check at settle time too — a user row can appear before its
    // [data-testid="user-message"] child is attached.
    if (!isAssistantRow(node)) return;

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
    root.querySelectorAll(ROW_SELECTOR).forEach((node) => {
      if (isAssistantRow(node)) scheduleSettleCheck(node);
    });
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType !== 1) return;
        if (isAssistantRow(node)) scheduleSettleCheck(node);
        scan(node);
      });
      // Streaming replies mutate text inside an already-added row —
      // re-arm the settle timer for whichever row changed.
      if (mutation.target && mutation.target.closest) {
        const container = mutation.target.closest(ROW_SELECTOR);
        if (container && isAssistantRow(container)) scheduleSettleCheck(container);
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true, characterData: true });

  // Catch replies already on the page at load (e.g. navigating into an existing chat).
  scan(document.body);

  // Local-only breakage detection — see lib/aicm-report.js.
  AICM.recordVisit(PLATFORM);
})();
