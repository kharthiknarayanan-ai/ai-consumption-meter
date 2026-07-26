// Two independent watchers on google.com:
//   1. AI Overview detection (ambient) — only on /search pages.
//   2. Autocomplete-suggestion-pick detection (decision) — any page with the
//      search box, since suggestions can appear on the homepage too.

// --- 1. AI Overview → 'ambient' -------------------------------------------
//
// Confirmed via manual DevTools inspection (2026-07-25): each paragraph/bullet
// of the generated answer is wrapped in a <span class="iNqyIf">. We sum the
// visible text across every matching span on the page to get the total
// answer length. Google explicitly keeps a hidden "AI Overview is not
// available for this search" fallback in the DOM even when a real overview
// *does* render, so we only count elements that are actually visible
// (offsetParent !== null) — plain textContent would double-count the hidden
// fallback text.
//
// NOTE ON FRAGILITY: Google's class names here are minified/obfuscated
// (e.g. "iNqyIf") and, based on how much this took to pin down, likely to
// change more often and more unpredictably than ChatGPT/Claude/Gemini's
// selectors did. If events stop appearing: search something that reliably
// triggers an AI Overview (a "why does X happen" / "how does X work" style
// question), right-click directly on the visible generated answer text →
// Inspect, and update CONTENT_SELECTOR below to whatever class that element
// has now.
(function watchAiOverview() {
  if (!location.pathname.startsWith('/search')) return;

  const PLATFORM = 'google_search';
  const CATEGORY = 'ambient';
  const CONTENT_SELECTOR = '.iNqyIf';
  const SETTLE_MS = 1500;
  const MIN_LEN = 40; // below this, treat it as noise rather than a real answer

  let logged = false;
  let settleTimer = null;

  function totalVisibleLength() {
    const nodes = [...document.querySelectorAll(CONTENT_SELECTOR)].filter((el) => el.offsetParent !== null);
    return nodes.reduce((sum, el) => sum + (el.textContent || '').trim().length, 0);
  }

  function visibleText() {
    return [...document.querySelectorAll(CONTENT_SELECTOR)]
      .filter((el) => el.offsetParent !== null)
      .map((el) => (el.textContent || '').trim())
      .join(' ');
  }

  function reportEvent() {
    if (logged) return;
    const text = visibleText();
    if (text.length < MIN_LEN) return; // still loading, or no real overview rendered

    logged = true;
    // Fingerprinted on the overview's own text, so re-running the same search
    // (or hitting back) doesn't log it again.
    AICM.report({ platform: PLATFORM, text, category: CATEGORY, surface: 'web' });
  }

  function scheduleSettleCheck() {
    if (logged) return;
    if (settleTimer) clearTimeout(settleTimer);
    settleTimer = setTimeout(reportEvent, SETTLE_MS);
  }

  const observer = new MutationObserver(() => {
    if (!logged && document.querySelector(CONTENT_SELECTOR)) scheduleSettleCheck();
    checkOverviewPresence();
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });

  // Health tracking for Google is deliberately different from the chat
  // platforms. Most searches legitimately have no AI Overview, so counting
  // plain page visits would cry wolf constantly.
  //
  // Instead we look for the "AI Overview" heading Google renders above the
  // block. If that heading is on screen but CONTENT_SELECTOR extracts nothing,
  // an overview really is present and we genuinely failed to read it — which
  // is exactly the breakage worth warning about, and nothing else.
  let presenceRecorded = false;
  function checkOverviewPresence() {
    if (presenceRecorded || logged) return;
    const heading = [...document.querySelectorAll('div,span,h1,h2')].find(
      (el) => el.children.length === 0 && el.textContent.trim() === 'AI Overview' && el.offsetParent !== null
    );
    if (!heading) return;
    presenceRecorded = true;
    // Give the page a moment to finish rendering the body before judging.
    setTimeout(() => {
      if (!logged && totalVisibleLength() < MIN_LEN) AICM.recordVisit(PLATFORM);
    }, SETTLE_MS * 2);
  }

  // Check once at load in case content is already present.
  if (document.querySelector(CONTENT_SELECTOR)) scheduleSettleCheck();
  checkOverviewPresence();
})();

// --- 2. Autocomplete suggestion picked → 'decision' ------------------------
//
// PLACEHOLDER: unverified. Targets the standard ARIA combobox pattern
// ([role="listbox"] containing [role="option"] items), which is a semantic
// accessibility hook rather than an obfuscated class name, so it has a
// decent shot at working as-is — but Google's search box has been rebuilt
// under different frameworks before, so treat this as unconfirmed until
// tested. To verify/fix: start typing a query until the suggestions dropdown
// appears, right-click one suggestion → Inspect, and check whether it (or an
// ancestor) actually has role="option" / role="listbox". If not, update
// OPTION_SELECTOR / LISTBOX_SELECTOR below to match what's really there.
(function watchAutocompleteDecisions() {
  const OPTION_SELECTOR = '[role="option"]';
  const LISTBOX_SELECTOR = '[role="listbox"]';
  const CATEGORY = 'decision';

  function logSuggestionPick(text) {
    AICM.report({ platform: 'google_search', text, category: CATEGORY, surface: 'web' });
  }

  document.addEventListener(
    'click',
    (e) => {
      const option = e.target.closest && e.target.closest(OPTION_SELECTOR);
      if (option) logSuggestionPick(option.textContent);
    },
    true
  );

  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 'Enter') return;
      const listbox = document.querySelector(LISTBOX_SELECTOR);
      if (!listbox) return;
      const highlighted = listbox.querySelector('[role="option"][aria-selected="true"]');
      if (highlighted) logSuggestionPick(highlighted.textContent);
    },
    true
  );
})();
