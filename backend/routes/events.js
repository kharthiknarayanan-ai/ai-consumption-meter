const express = require('express');
const { addEvent } = require('../db');
const { computeAiu } = require('../aiu');

const router = express.Router();

const VALID_PLATFORMS = ['chatgpt', 'claude', 'gemini', 'google_search'];
const VALID_CATEGORIES = ['direct_query', 'delegated_creation', 'decision', 'ambient'];
const VALID_SOURCES = ['browser_extension', 'desktop_agent', 'mobile_agent', 'manual'];
const VALID_SIGNAL_TYPES = ['chars', 'time'];
const VALID_CONFIDENCE = ['measured', 'inferred', 'self_reported'];

// POST /api/events
// Character-signal body (browser extensions):
//   { platform, outputLength, category?, deviceId?, source?, fingerprint?, timestamp? }
// Time-signal body (future native agents):
//   { platform, activeMs, signalType: 'time', deviceId, source: 'desktop_agent', ... }
router.post('/', (req, res) => {
  const body = req.body || {};
  const {
    platform,
    outputLength,
    activeMs,
    category,
    timestamp,
    sessionId,
    deviceId,
    source,
    signalType,
    confidence,
    surface,
    fingerprint,
  } = body;

  if (!VALID_PLATFORMS.includes(platform)) {
    return res.status(400).json({ error: `platform must be one of ${VALID_PLATFORMS.join(', ')}` });
  }

  const finalSignalType = VALID_SIGNAL_TYPES.includes(signalType) ? signalType : 'chars';

  // Each signal type has its own required measurement field. Enforcing this
  // keeps 'minutes' and 'characters' from ever ending up in the same column.
  if (finalSignalType === 'chars') {
    if (typeof outputLength !== 'number' || outputLength < 0) {
      return res.status(400).json({ error: "signalType 'chars' requires a non-negative outputLength" });
    }
  } else if (typeof activeMs !== 'number' || activeMs < 0) {
    return res.status(400).json({ error: "signalType 'time' requires a non-negative activeMs" });
  }

  const finalCategory = VALID_CATEGORIES.includes(category) ? category : 'direct_query';
  const finalSource = VALID_SOURCES.includes(source) ? source : 'browser_extension';
  const finalConfidence = VALID_CONFIDENCE.includes(confidence)
    ? confidence
    : finalSignalType === 'chars'
      ? 'measured'
      : 'inferred';
  const finalTimestamp = typeof timestamp === 'number' ? timestamp : Date.now();

  // Only character-signal events produce aiU. Time-signal events are reported
  // in their own track (see docs/ecosystem-architecture.md) rather than being
  // converted, so they deliberately carry aiU = 0.
  const aiu = finalSignalType === 'chars' ? computeAiu(outputLength, finalCategory) : 0;

  const { record, duplicate } = addEvent({
    platform,
    category: finalCategory,
    outputLength: finalSignalType === 'chars' ? outputLength : null,
    activeMs: finalSignalType === 'time' ? activeMs : null,
    aiu,
    signalType: finalSignalType,
    source: finalSource,
    confidence: finalConfidence,
    surface: surface || 'web',
    deviceId: deviceId || 'unknown-device',
    fingerprint: fingerprint || null,
    sessionId: sessionId || null,
    timestamp: finalTimestamp,
  });

  // 200 (not 201) signals "already known, nothing created" without making the
  // client treat it as an error — it's the expected outcome when the same
  // reply is seen again on scrollback or from another device.
  res.status(duplicate ? 200 : 201).json({ ...record, duplicate });
});

module.exports = router;
