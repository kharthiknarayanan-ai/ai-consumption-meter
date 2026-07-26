// Aggregates daily rollups into the same response shape the Node backend's
// /api/stats used to return. Keeping the shape identical means the dashboard
// rendering code didn't have to change when storage moved into the extension.
(function (root, factory) {
  // Prefer an already-loaded global over require(): in the extension the libs
  // are loaded as plain <script> tags, and reaching for require() first would
  // break in any context where both happen to be available.
  const dep =
    (root && root.AICM_INSIGHTS) ||
    (typeof require === 'function' ? require('./aicm-insights.js') : null);
  if (!dep) throw new Error('aicm-stats: aicm-insights must be loaded first');

  const mod = factory(dep);
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else root.AICM_STATS = mod;
})(typeof self !== 'undefined' ? self : this, function (insights) {
  const RANGE_DAYS = { today: 1, week: 7, month: 30 };
  const TREND_DAYS = 14;

  function dayKey(ts) {
    return new Date(ts).toISOString().slice(0, 10);
  }

  function round2(n) {
    return Math.round(n * 100) / 100;
  }

  function parseBucketKey(key) {
    const [platform, category, signalType] = key.split('|');
    return { platform, category, signalType };
  }

  // range: 'today' | 'week' | 'month' | 'all'
  function computeStats(rollups, range = 'week', deviceId = 'this-device') {
    const days = Object.keys(rollups || {}).sort();

    // Ranges are inclusive calendar windows: 'today' is today only, 'week' is
    // today plus the previous 6 days. (The old server used a rolling 24-hour
    // window, which day-granularity rollups can't express — and calendar days
    // are what people actually mean by "today" anyway.)
    const spanDays = RANGE_DAYS[range] || 7;
    const cutoffDay = range === 'all' ? '0000-00-00' : dayKey(Date.now() - (spanDays - 1) * 86400000);

    const inRange = days.filter((d) => d >= cutoffDay);

    const byPlatform = {};
    const byCategory = {};
    let totalAiu = 0;
    let eventCount = 0;
    let totalChars = 0;
    const activeDaySet = new Set();

    // Time-signal buckets are tracked separately and never folded into aiU —
    // minutes and characters are different units (see
    // docs/ecosystem-architecture.md).
    const observedTime = { totalMinutes: 0, eventCount: 0, byPlatform: {} };

    for (const day of inRange) {
      for (const [key, bucket] of Object.entries(rollups[day] || {})) {
        const { platform, category, signalType } = parseBucketKey(key);

        if (signalType === 'time') {
          observedTime.eventCount += bucket.count;
          observedTime.totalMinutes += (bucket.activeMs || 0) / 60000;
          observedTime.byPlatform[platform] =
            Math.round(((observedTime.byPlatform[platform] || 0) + (bucket.activeMs || 0) / 60000) * 10) / 10;
          continue;
        }

        byPlatform[platform] = round2((byPlatform[platform] || 0) + bucket.aiu);
        byCategory[category] = round2((byCategory[category] || 0) + bucket.aiu);
        totalAiu += bucket.aiu;
        eventCount += bucket.count;
        totalChars += bucket.outputLength || 0;
        if (bucket.count > 0) activeDaySet.add(day);
      }
    }

    observedTime.totalMinutes = Math.round(observedTime.totalMinutes);

    // Trend always spans the last 14 days regardless of the selected range, so
    // the chart's context doesn't shift when you change the range picker.
    const trend = [];
    for (let i = TREND_DAYS - 1; i >= 0; i--) {
      const key = dayKey(Date.now() - i * 86400000);
      const dayBuckets = rollups[key] || {};
      const aiu = Object.entries(dayBuckets)
        .filter(([k]) => parseBucketKey(k).signalType !== 'time')
        .reduce((sum, [, b]) => sum + b.aiu, 0);
      trend.push({ date: key, aiu: round2(aiu) });
    }

    // For 'all', measure consistency against the real span of recorded data so
    // long-time users aren't penalised for having a long history.
    let windowDays = RANGE_DAYS[range] || 7;
    if (range === 'all' && days.length > 0) {
      const oldest = new Date(days[0] + 'T00:00:00Z').getTime();
      windowDays = Math.max(1, Math.ceil((Date.now() - oldest) / 86400000));
    }

    const built = insights.buildInsights({
      totalChars,
      activeDays: activeDaySet.size,
      eventCount,
      byPlatform,
      byCategory,
      windowDays,
    });

    return {
      range,
      totalAiu: round2(totalAiu),
      eventCount,
      byPlatform,
      byCategory,
      byDevice: eventCount > 0 ? { [deviceId]: round2(totalAiu) } : {},
      observedTime,
      trend,
      insights: built,
    };
  }

  return { computeStats, RANGE_DAYS, TREND_DAYS };
});
