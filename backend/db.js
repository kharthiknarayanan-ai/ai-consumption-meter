// Minimal file-based store. No native modules (no SQLite bindings) on purpose,
// so this runs on any machine with just Node.js installed — no build toolchain
// needed for the person setting this up.
//
// Schema v2 (multi-device) adds deviceId/source/signalType/confidence/
// fingerprint. v1 events are migrated on read — the file on disk is only
// rewritten when something is actually added, so an old data file is never
// destructively upgraded just by being opened.
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'events.json');

const CURRENT_SCHEMA = 2;

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ events: [] }, null, 2));
  }
}

// Backfill v1 records with sensible v2 defaults. Everything logged before the
// multi-device work came from the Chrome extension on one machine, measuring
// characters — so those are the defaults, and they're accurate rather than
// merely convenient.
function migrateEvent(event) {
  if (event.schemaVersion === CURRENT_SCHEMA) return event;
  return {
    ...event,
    deviceId: event.deviceId || 'legacy-device',
    source: event.source || 'browser_extension',
    signalType: event.signalType || 'chars',
    confidence: event.confidence || 'measured',
    surface: event.surface || 'web',
    activeMs: event.activeMs ?? null,
    fingerprint: event.fingerprint || null,
    schemaVersion: CURRENT_SCHEMA,
  };
}

function readAll() {
  ensureStore();
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    // Corrupt file — back it up and start fresh rather than crashing the server.
    fs.renameSync(DATA_FILE, `${DATA_FILE}.corrupt-${Date.now()}`);
    return { events: [] };
  }
  data.events = (data.events || []).map(migrateEvent);
  return data;
}

function writeAll(data) {
  ensureStore();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function nextId(events) {
  // IDs were sequential integers in v1. Keep that rather than switching to
  // UUIDs mid-stream — a local single-writer store doesn't need them, and
  // stable small ids are far easier to eyeball when debugging.
  return events.reduce((max, e) => Math.max(max, Number(e.id) || 0), 0) + 1;
}

// Returns { record, duplicate }. If an event with the same fingerprint already
// exists, nothing is written and the existing record comes back instead —
// this is what stops the same reply being counted twice when it's seen again
// on reload, on scrollback, or (later) from a second device.
function addEvent(event) {
  const data = readAll();

  if (event.fingerprint) {
    const existing = data.events.find((e) => e.fingerprint === event.fingerprint);
    if (existing) return { record: existing, duplicate: true };
  }

  const record = migrateEvent({ id: nextId(data.events), ...event });
  data.events.push(record);
  writeAll(data);
  return { record, duplicate: false };
}

function getEvents() {
  return readAll().events;
}

module.exports = { addEvent, getEvents, migrateEvent, CURRENT_SCHEMA };
