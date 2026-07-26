// Shared reporting helper injected into every content script.
//
// Solves a bug the single-device build had: dedup used to rely on a
// `data-aicmLogged` attribute set on the DOM node. That attribute dies with
// the page, so scrolling back through an old conversation — or simply
// reloading a chat — re-logged replies that had already been counted, silently
// inflating totals.
//
// Now every reply gets a content fingerprint persisted in chrome.storage.local,
// so a given reply is counted once per browser profile no matter how many times
// it's rendered. The same fingerprint is sent to the backend, which does its own
// dedup — that second layer is what will stop double-counting across devices
// once sync exists, since the platforms all sync conversation history.

// Assigned explicitly onto the global rather than declared with `const`.
// Content scripts listed together in the manifest share one global lexical
// scope, so `const` does work — but relying on that is an implicit contract
// between files. An explicit global property is unambiguous, and behaves the
// same whether this is loaded as a content script or via a <script> tag in
// the popup.
globalThis.AICM = (() => {
  const SEEN_KEY = 'aicm_seen_fingerprints';
  const DEVICE_KEY = 'aicm_device_id';
  const HEALTH_KEY = 'aicm_health';
  const MAX_SEEN = 5000; // ring-buffer cap; oldest fall off first

  // Detection-health tracking. Purely local — nothing is transmitted anywhere.
  //
  // The problem this solves: these content scripts depend on the markup of
  // sites we don't control, and that markup changes without warning. When it
  // does, detection silently stops and the user has no idea their meter has
  // gone blind. Without this, the first signal of breakage is a confused
  // one-star review.
  //
  // How it works: every page load on a supported site records a "visit" for
  // that platform, and every successful detection records a "match". If a
  // platform accumulates visits with no match ever recorded, it's flagged as
  // likely broken and the popup tells the user to check for an update.
  //
  // Two guards against false alarms, because a wrong warning is worse than a
  // slow one — it erodes trust in a tool whose entire value is being believed:
  //   1. Several dry visits are required, not one.
  //   2. Those visits must span at least two distinct days. Opening a chat
  //      site a few times in one session without sending anything is normal
  //      behaviour; a genuine markup break persists across days.
  const VISITS_BEFORE_WARNING = 3;
  const DISTINCT_DAYS_BEFORE_WARNING = 2;

  let seenCache = null;
  let deviceIdCache = null;

  async function getDeviceId() {
    if (deviceIdCache) return deviceIdCache;
    const stored = await chrome.storage.local.get([DEVICE_KEY]);
    if (stored[DEVICE_KEY]) {
      deviceIdCache = stored[DEVICE_KEY];
    } else {
      // Random, local-only, not derived from anything identifying. Its only
      // job is telling this browser's events apart from another device's.
      deviceIdCache = `dev-${crypto.randomUUID().slice(0, 8)}`;
      await chrome.storage.local.set({ [DEVICE_KEY]: deviceIdCache });
    }
    return deviceIdCache;
  }

  async function loadSeen() {
    if (seenCache) return seenCache;
    const stored = await chrome.storage.local.get([SEEN_KEY]);
    seenCache = stored[SEEN_KEY] || [];
    return seenCache;
  }

  async function markSeen(fingerprint) {
    const seen = await loadSeen();
    seen.push(fingerprint);
    if (seen.length > MAX_SEEN) seen.splice(0, seen.length - MAX_SEEN);
    seenCache = seen;
    await chrome.storage.local.set({ [SEEN_KEY]: seen });
  }

  // Cheap, dependency-free 53-bit hash (FNV-style variant). Not cryptographic
  // — it only needs to make accidental collisions vanishingly unlikely across
  // one person's chat history, and it avoids pulling in a hashing library or
  // going async on SubtleCrypto for every message.
  function hash(str) {
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  }

  // Fingerprint from platform + normalized head of the text + length. Using the
  // head rather than the whole body keeps it stable against trailing UI text
  // (action-bar labels, disclaimers) that some platforms append to the node.
  function fingerprintFor(platform, text) {
    const normalized = text.replace(/\s+/g, ' ').trim();
    return `${platform}:${hash(normalized.slice(0, 200))}:${normalized.length}`;
  }

  // --- Detection health (local only, never transmitted) ---

  async function loadHealth() {
    const stored = await chrome.storage.local.get([HEALTH_KEY]);
    return stored[HEALTH_KEY] || {};
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  async function updateHealth(platform, mutate) {
    const health = await loadHealth();
    const entry = health[platform] || {
      visits: 0,
      matches: 0,
      dryDays: [],
      lastMatchAt: null,
      lastVisitAt: null,
    };
    if (!Array.isArray(entry.dryDays)) entry.dryDays = []; // tolerate older stored shapes
    mutate(entry);
    health[platform] = entry;
    await chrome.storage.local.set({ [HEALTH_KEY]: health });
  }

  // Called once per page load by each content script, before any detection.
  async function recordVisit(platform) {
    await updateHealth(platform, (e) => {
      e.visits += 1;
      e.lastVisitAt = Date.now();
      const day = today();
      if (!e.dryDays.includes(day)) e.dryDays.push(day);
      if (e.dryDays.length > 30) e.dryDays.shift();
    });
  }

  // Called whenever a selector actually matched something real.
  async function recordMatch(platform) {
    await updateHealth(platform, (e) => {
      e.matches += 1;
      e.lastMatchAt = Date.now();
      // Reset on success so an old dry spell doesn't keep triggering warnings
      // once detection is working again.
      e.visits = 0;
      e.dryDays = [];
    });
  }

  // A platform is "likely broken" only if the script loaded there several
  // times, across at least two different days, without a single successful
  // detection in that stretch.
  function evaluateHealth(health) {
    const problems = [];
    for (const [platform, entry] of Object.entries(health || {})) {
      const dryDays = Array.isArray(entry.dryDays) ? entry.dryDays.length : 0;
      const enoughVisits = entry.visits >= VISITS_BEFORE_WARNING;
      const enoughDays = dryDays >= DISTINCT_DAYS_BEFORE_WARNING;
      if (!enoughVisits || !enoughDays) continue;

      problems.push({
        platform,
        // 'stopped_matching' means it demonstrably worked before, which is a
        // much stronger signal of a site change than never having worked
        // (which could just as easily be a bad install or an unused platform).
        reason: entry.lastMatchAt ? 'stopped_matching' : 'never_matched',
        visits: entry.visits,
        dryDays,
      });
    }
    return problems;
  }

  // Returns true if the event was newly reported, false if it was a duplicate.
  async function report({ platform, text, category, surface = 'web' }) {
    const clean = (text || '').trim();
    if (!clean) return false;

    // Detection worked — record that before the dedup check, since a duplicate
    // still proves the selector is finding content correctly.
    await recordMatch(platform);

    const fingerprint = fingerprintFor(platform, clean);
    const seen = await loadSeen();
    if (seen.includes(fingerprint)) return false;

    await markSeen(fingerprint);

    chrome.runtime.sendMessage({
      type: 'AICM_EVENT',
      payload: {
        platform,
        outputLength: clean.length,
        category,
        surface,
        fingerprint,
        deviceId: await getDeviceId(),
        source: 'browser_extension',
        signalType: 'chars',
        confidence: 'measured',
      },
    });
    return true;
  }

  return { report, fingerprintFor, getDeviceId, recordVisit, recordMatch, loadHealth, evaluateHealth };
})();
