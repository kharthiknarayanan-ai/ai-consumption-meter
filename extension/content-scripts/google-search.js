// Detects Google's AI Overview — the generated summary above search results —
// and records it as 'ambient' consumption: AI you didn't ask for that was put
// in front of you anyway.
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

// REMOVED (2026-07-26): autocomplete-suggestion tracking for the 'decision'
// category. It targeted the standard ARIA combobox pattern
// ([role="listbox"] / [role="option"]), which Google's search box does not
// use — verified live: zero matching elements with the suggestions dropdown
// open. The code could never have fired.
//
// The 'decision' category still exists in the data model (see lib/aicm-aiu.js)
// as designed-but-unimplemented, but nothing currently produces it, so it is
// no longer described anywhere user-facing. Implementing it properly needs a
// real selector for whatever markup Google actually uses, or a different
// decision source entirely (e.g. Gmail Smart Reply).
