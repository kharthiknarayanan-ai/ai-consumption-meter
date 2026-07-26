const express = require('express');
const { getEvents } = require('../db');
const { buildInsights } = require('../insights');

const router = express.Router();

const RANGE_MS = {
  today: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
};

const RANGE_DAYS = { today: 1, week: 7, month: 30 };

function dayKey(timestamp) {
  const d = new Date(timestamp);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function sum(events) {
  return Math.round(events.reduce((acc, e) => acc + e.aiu, 0) * 100) / 100;
}

function groupBy(events, keyFn) {
  const out = {};
  for (const e of events) {
    const key = keyFn(e);
    out[key] = (out[key] || 0) + e.aiu;
  }
  for (const key of Object.keys(out)) {
    out[key] = Math.round(out[key] * 100) / 100;
  }
  return out;
}

// GET /api/stats?range=today|week|month|all
router.get('/', (req, res) => {
  const range = req.query.range || 'week';
  const allEvents = getEvents();

  const cutoff = range === 'all' ? 0 : Date.now() - (RANGE_MS[range] || RANGE_MS.week);
  const inRange = allEvents.filter((e) => e.timestamp >= cutoff);

  // The two signal tracks are kept apart on purpose: aiU is only ever derived
  // from measured character counts, while time observations from native agents
  // are reported separately in minutes. Summing them would be a category error
  // (see docs/ecosystem-architecture.md).
  const events = inRange.filter((e) => (e.signalType || 'chars') === 'chars');
  const timeEvents = inRange.filter((e) => e.signalType === 'time');

  const byPlatform = groupBy(events, (e) => e.platform);
  const byCategory = groupBy(events, (e) => e.category);
  const byDevice = groupBy(events, (e) => e.deviceId || 'unknown-device');

  const observedTime = {
    totalMinutes: Math.round(timeEvents.reduce((sum, e) => sum + (e.activeMs || 0), 0) / 60000),
    eventCount: timeEvents.length,
    byPlatform: timeEvents.reduce((acc, e) => {
      const key = e.platform;
      acc[key] = Math.round(((acc[key] || 0) + (e.activeMs || 0) / 60000) * 10) / 10;
      return acc;
    }, {}),
  };

  // Trend: last 14 days, oldest first, always computed from all events
  // (independent of the selected range) so the chart context doesn't jump around.
  const trendDays = 14;
  const trendCutoff = Date.now() - trendDays * 24 * 60 * 60 * 1000;
  const trendEvents = allEvents.filter(
    (e) => e.timestamp >= trendCutoff && (e.signalType || 'chars') === 'chars'
  );
  const trendMap = groupBy(trendEvents, (e) => dayKey(e.timestamp));
  const trend = [];
  for (let i = trendDays - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const key = dayKey(d.getTime());
    trend.push({ date: key, aiu: trendMap[key] || 0 });
  }

  // For 'all', measure consistency against the actual span of recorded data
  // rather than an arbitrary window, so early adopters aren't penalised for
  // having a long history.
  let windowDays = RANGE_DAYS[range] || 7;
  if (range === 'all' && events.length > 0) {
    const oldest = Math.min(...events.map((e) => e.timestamp));
    windowDays = Math.max(1, Math.ceil((Date.now() - oldest) / (24 * 60 * 60 * 1000)));
  }

  // buildInsights takes precomputed totals so the extension (rollups) and this
  // backend (raw events) can share one implementation.
  const insights = buildInsights({
    totalChars: events.reduce((s, e) => s + (e.outputLength || 0), 0),
    activeDays: new Set(events.map((e) => dayKey(e.timestamp))).size,
    eventCount: events.length,
    byPlatform,
    byCategory,
    windowDays,
  });

  res.json({
    range,
    totalAiu: sum(events),
    eventCount: events.length,
    byPlatform,
    byCategory,
    byDevice,
    observedTime,
    trend,
    insights,
  });
});

module.exports = router;
