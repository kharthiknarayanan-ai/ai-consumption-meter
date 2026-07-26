// Receives detection events from content scripts and records them locally.
//
// Everything is stored in chrome.storage.local as daily rollups. By default
// the extension makes NO network requests at all — no server, no account, no
// analytics. Forwarding to a local Node backend is available as an advanced
// option (off unless the user explicitly enables it and grants permission),
// for people who want the raw event log or their own dashboard.
importScripts('lib/aicm-aiu.js', 'lib/aicm-store.js');

const BACKEND_URL = 'http://localhost:4141/api/events';
const BACKEND_FLAG = 'aicm_backend_enabled';

async function backendEnabled() {
  const stored = await chrome.storage.local.get([BACKEND_FLAG]);
  return stored[BACKEND_FLAG] === true;
}

// Best-effort mirror to the optional local backend. Never blocks or fails the
// local write — the extension's own store is the source of truth.
async function forwardToBackend(payload, aiu) {
  if (!(await backendEnabled())) return;
  try {
    await fetch(BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, aiu }),
    });
  } catch (err) {
    console.warn('[AICM] optional backend forward failed (local data is unaffected)', err);
  }
}

async function handleEvent(payload) {
  const signalType = payload.signalType || 'chars';
  const category = payload.category || 'direct_query';

  // Only character-signal events produce aiU. Time observations are recorded
  // in their own track and never converted (see docs/ecosystem-architecture.md).
  const aiu = signalType === 'chars' ? AICM_AIU.computeAiu(payload.outputLength, category) : 0;

  await AICM_STORE.recordEvent({
    platform: payload.platform,
    category,
    signalType,
    outputLength: payload.outputLength || 0,
    activeMs: payload.activeMs || 0,
    aiu,
    timestamp: payload.timestamp || Date.now(),
  });

  // Rolling "today" counter so the popup renders instantly without
  // re-aggregating the whole store.
  const day = new Date().toISOString().slice(0, 10);
  const stored = await chrome.storage.local.get(['aicm_today']);
  const today = stored.aicm_today || {};
  if (today.date !== day) {
    today.date = day;
    today.aiu = 0;
    today.count = 0;
  }
  today.aiu = Math.round(((today.aiu || 0) + aiu) * 100) / 100;
  today.count = (today.count || 0) + 1;
  await chrome.storage.local.set({ aicm_today: today });

  await forwardToBackend(payload, aiu);
  return { aiu };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'AICM_EVENT') return undefined;

  handleEvent(message.payload)
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((err) => {
      console.error('[AICM] failed to record event', err);
      sendResponse({ ok: false, error: String(err) });
    });

  return true; // keep the message channel open for the async sendResponse
});

// First install: open the dashboard so the user immediately sees what this is
// and where their data lives, rather than an unexplained toolbar icon.
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/dashboard.html?welcome=1') });
  }
});
