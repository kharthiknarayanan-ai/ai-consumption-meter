// Local event store, backed by chrome.storage.local. This is what makes the
// extension standalone — no server, no terminal, nothing to install.
//
// WHY DAILY ROLLUPS, NOT RAW EVENTS
// chrome.storage.local is ~10MB. Storing one row per AI reply would grow
// without bound and eventually start failing writes silently, which for a tool
// whose value is accumulated history is the worst possible failure. Rollups
// are bounded by (days × platforms × categories), which is tiny — roughly
// 400 days of heavy use fits in well under 1MB.
//
// Everything the dashboard shows (totals, breakdowns, trend, persona,
// man-days) is derivable from rollups, so nothing is lost by not keeping
// individual events.
(function (root, factory) {
  const mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else root.AICM_STORE = mod;
})(typeof self !== 'undefined' ? self : this, function () {
  const ROLLUP_KEY = 'aicm_rollups';
  const META_KEY = 'aicm_meta';
  const SCHEMA_VERSION = 1;

  // Keep just over a year so year-on-year comparison is possible later.
  const RETENTION_DAYS = 400;

  function dayKey(timestamp) {
    return new Date(timestamp).toISOString().slice(0, 10);
  }

  // Flat composite key keeps the structure two levels deep (day → bucket)
  // instead of four, which makes aggregation a simple loop and keeps the
  // JSON small.
  function bucketKey(platform, category, signalType) {
    return `${platform}|${category}|${signalType}`;
  }

  function parseBucketKey(key) {
    const [platform, category, signalType] = key.split('|');
    return { platform, category, signalType };
  }

  async function readRollups() {
    const stored = await chrome.storage.local.get([ROLLUP_KEY]);
    return stored[ROLLUP_KEY] || {};
  }

  async function writeRollups(rollups) {
    await chrome.storage.local.set({ [ROLLUP_KEY]: rollups });
  }

  // Drop days beyond the retention window. Called on every write — cheap,
  // since it's a key comparison over a few hundred entries.
  function prune(rollups) {
    const cutoff = dayKey(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
    for (const day of Object.keys(rollups)) {
      if (day < cutoff) delete rollups[day];
    }
    return rollups;
  }

  async function recordEvent({
    platform,
    category,
    signalType = 'chars',
    outputLength = 0,
    activeMs = 0,
    aiu = 0,
    timestamp = Date.now(),
  }) {
    const rollups = await readRollups();
    const day = dayKey(timestamp);
    const key = bucketKey(platform, category, signalType);

    if (!rollups[day]) rollups[day] = {};
    const bucket = rollups[day][key] || { count: 0, outputLength: 0, activeMs: 0, aiu: 0 };

    bucket.count += 1;
    bucket.outputLength += outputLength || 0;
    bucket.activeMs += activeMs || 0;
    bucket.aiu = Math.round((bucket.aiu + (aiu || 0)) * 100) / 100;

    rollups[day][key] = bucket;
    prune(rollups);

    try {
      await writeRollups(rollups);
    } catch (err) {
      // Quota exhaustion is the realistic failure here. Rather than losing the
      // write silently, drop the oldest quarter of history and retry once —
      // recent data matters more than old data, and a partial history beats a
      // meter that has quietly stopped recording.
      console.warn('[AICM] storage write failed, pruning aggressively', err);
      const days = Object.keys(rollups).sort();
      days.slice(0, Math.ceil(days.length / 4)).forEach((d) => delete rollups[d]);
      await writeRollups(rollups);
    }

    await chrome.storage.local.set({
      [META_KEY]: { schemaVersion: SCHEMA_VERSION, lastWriteAt: Date.now() },
    });

    return bucket;
  }

  async function clearAll() {
    await chrome.storage.local.remove([ROLLUP_KEY, META_KEY]);
  }

  // Full local export — powers the "download my data" control. Everything the
  // extension knows, in one JSON file the user owns.
  async function exportAll() {
    const all = await chrome.storage.local.get(null);
    return {
      exportedAt: new Date().toISOString(),
      schemaVersion: SCHEMA_VERSION,
      rollups: all[ROLLUP_KEY] || {},
      meta: all[META_KEY] || null,
      deviceId: all.aicm_device_id || null,
      health: all.aicm_health || {},
    };
  }

  async function estimateUsage() {
    // getBytesInUse isn't available in every context; fall back to a rough
    // JSON length so the UI can still show something meaningful.
    try {
      const bytes = await chrome.storage.local.getBytesInUse(null);
      return { bytes, quota: chrome.storage.local.QUOTA_BYTES || 10485760 };
    } catch (err) {
      const all = await chrome.storage.local.get(null);
      return { bytes: JSON.stringify(all).length, quota: 10485760 };
    }
  }

  return {
    recordEvent,
    readRollups,
    clearAll,
    exportAll,
    estimateUsage,
    dayKey,
    bucketKey,
    parseBucketKey,
    RETENTION_DAYS,
    SCHEMA_VERSION,
  };
});
