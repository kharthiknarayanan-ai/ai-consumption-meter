// Detects completed assistant responses on chatgpt.com / chat.openai.com and
// reports their length to the background worker, which forwards it to the
// local backend as one "consumption event."
//
// NOTE ON FRAGILITY: this relies on ChatGPT's current DOM structure
// (`data-message-author-role="assistant"`). If OpenAI changes their markup,
// this selector will need updating — open DevTools on a chat, inspect an
// assistant reply, and adjust SELECTOR below.
//
// CATEGORY HEURISTIC: replies at or above DELEGATED_CREATION_MIN_LEN chars
// are logged as 'delegated_creation' instead of 'direct_query'. This is a
// length-based proxy, not real intent detection — a long reply is more
// likely to be a drafted piece of content you'll actually use/publish than
// a quick answer. See the README for the reasoning.
(function () {
  const PLATFORM = 'chatgpt';
  const SELECTOR = '[data-message-author-role="assistant"]';
  const SETTLE_MS = 1500; // wait this long after the last DOM change before treating a reply as "final"
  const DELEGATED_CREATION_MIN_LEN = 800;

  const settleTimers = new WeakMap();

  function classifyCategory(length) {
    return length >= DELEGATED_CREATION_MIN_LEN ? 'delegated_creation' : 'direct_query';
  }

  function reportEvent(node) {
    if (node.dataset.aicmLogged === '1') return;
    const text = (node.textContent || '').trim();
    if (!text) return;

    // The DOM flag is just a cheap in-page guard; AICM.report does the real,
    // persistent dedup by content fingerprint so reloads and scrollback don't
    // re-count replies (see lib/aicm-report.js).
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
      // re-arm the settle timer for whichever assistant bubble changed.
      if (mutation.target && mutation.target.closest) {
        const container = mutation.target.closest(SELECTOR);
        if (container) scheduleSettleCheck(container);
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true, characterData: true });

  // Catch messages already present on load (e.g. navigating into an existing chat).
  scan(document.body);

  // Local-only breakage detection — see lib/aicm-report.js.
  AICM.recordVisit(PLATFORM);
})();
