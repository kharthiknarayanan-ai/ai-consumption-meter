// Popup: today's reading, plus any local detection-health warnings.
// Reads only from chrome.storage.local — no network calls.

function renderToday() {
  chrome.storage.local.get(['aicm_today'], (result) => {
    const today = result.aicm_today || {};
    const day = new Date().toISOString().slice(0, 10);
    const value = today.date === day ? today.aiu || 0 : 0;
    const count = today.date === day ? today.count || 0 : 0;

    document.getElementById('todayValue').textContent = value.toFixed(1);
    document.getElementById('todayCount').textContent = `${count} event${count === 1 ? '' : 's'} logged today`;
  });
}

// Surfaces local detection-health problems to the user. Nothing here phones
// home — the extension notices its own breakage and tells the person, rather
// than telling us. The "Report this" link opens a prefilled GitHub issue the
// user can read and choose to submit.
const REPO_ISSUE_URL = 'https://github.com/kharthiknarayanan-ai/ai-consumption-meter/issues/new';

const PLATFORM_LABELS = {
  chatgpt: 'ChatGPT',
  claude: 'Claude',
  gemini: 'Gemini',
  google_search: 'Google AI Overview',
};

function buildIssueUrl(problems) {
  const version = chrome.runtime.getManifest().version;
  const affected = problems.map((p) => PLATFORM_LABELS[p.platform] || p.platform).join(', ');
  const title = `Detection not working: ${affected}`;
  const body = [
    `**Affected:** ${affected}`,
    `**Extension version:** ${version}`,
    '',
    'Detection stopped matching on the site(s) above — likely a markup change.',
    '',
    '<!-- No usage data is included in this report. Add anything else useful below. -->',
  ].join('\n');
  return `${REPO_ISSUE_URL}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
}

async function checkHealth() {
  try {
    const health = await AICM.loadHealth();
    const problems = AICM.evaluateHealth(health);
    if (problems.length === 0) return;

    const names = problems.map((p) => PLATFORM_LABELS[p.platform] || p.platform).join(', ');
    document.getElementById('healthDetail').textContent =
      `No results detected on ${names} across several visits. The site's layout may have changed — check for an extension update.`;
    document.getElementById('reportLink').href = buildIssueUrl(problems);
    document.getElementById('healthWarning').hidden = false;
  } catch (err) {
    // Health reporting is a nicety; never let it break the popup.
    console.warn('[AICM] health check failed', err);
  }
}

document.getElementById('openDashboard').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/dashboard.html') });
});

renderToday();
checkHealth();
