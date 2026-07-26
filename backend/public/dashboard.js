let currentRange = 'week';
let showAverage = true;

const PLATFORM_COLORS = {
  chatgpt: '#10a37f',
  claude: '#d97757',
  gemini: '#4285f4',
  google_search: '#34a853',
};

const CATEGORY_COLORS = {
  direct_query: '#34d399',
  delegated_creation: '#60a5fa',
  decision: '#fbbf24',
  ambient: '#a78bfa',
};

const FALLBACK_COLORS = ['#6b7280', '#94a3b8', '#71717a'];

function colorFor(map, key, index) {
  return map[key] || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

function labelize(key) {
  return key.replace(/_/g, ' ');
}

const CHART_FONT = { family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", size: 12 };

// Guard every top-level Chart.* reference behind this — if the bundled
// vendor/chart.umd.js file is missing for any reason, `Chart` is undefined,
// and touching it outside a check crashes this whole script (which used to
// silently break range buttons, refresh, everything — not just the charts).
const CHART_AVAILABLE = typeof Chart !== 'undefined';

if (CHART_AVAILABLE) {
  Chart.defaults.color = '#a3a3a3';
  Chart.defaults.font = CHART_FONT;
  Chart.defaults.borderColor = '#21242b';
}

let platformChart = null;
let categoryChart = null;
let trendChart = null;

async function fetchStats(range) {
  const res = await fetch(`/api/stats?range=${range}`);
  if (!res.ok) throw new Error(`Stats request failed: ${res.status}`);
  return res.json();
}

function buildDoughnutConfig(data, colorMap) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, v]) => sum + v, 0);

  return {
    type: 'doughnut',
    data: {
      labels: entries.map(([k]) => labelize(k)),
      datasets: [
        {
          data: entries.map(([, v]) => v),
          backgroundColor: entries.map(([k], i) => colorFor(colorMap, k, i)),
          borderColor: '#15171c',
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { boxWidth: 10, boxHeight: 10, padding: 12, usePointStyle: true, pointStyle: 'circle' },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(0) : 0;
              return `${ctx.label}: ${ctx.parsed.toFixed(1)} aiU (${pct}%)`;
            },
          },
        },
      },
    },
  };
}

function setEmptyState(canvas, show) {
  const wrap = canvas.parentElement;
  let msg = wrap.querySelector('.empty-state');
  if (show) {
    canvas.style.display = 'none';
    if (!msg) {
      msg = document.createElement('div');
      msg.className = 'empty-state';
      msg.textContent = 'No data yet for this range.';
      wrap.appendChild(msg);
    }
  } else {
    canvas.style.display = '';
    if (msg) msg.remove();
  }
}

function renderDoughnut(canvasId, existingChart, data, colorMap) {
  const canvas = document.getElementById(canvasId);
  const config = buildDoughnutConfig(data, colorMap);

  if (Object.keys(data).length === 0) {
    if (existingChart) existingChart.destroy();
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setEmptyState(canvas, true);
    return null;
  }
  setEmptyState(canvas, false);

  if (existingChart) {
    existingChart.data = config.data;
    existingChart.update();
    return existingChart;
  }
  return new Chart(canvas, config);
}

function movingAverage(values, windowSize) {
  return values.map((_, i) => {
    const start = Math.max(0, i - windowSize + 1);
    const slice = values.slice(start, i + 1);
    return slice.reduce((sum, v) => sum + v, 0) / slice.length;
  });
}

function renderTrend(trend) {
  const canvas = document.getElementById('trendChart');
  const labels = trend.map(({ date }) =>
    new Date(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  );
  const values = trend.map((t) => t.aiu);
  const avg = movingAverage(values, 7);

  const datasets = [
    {
      type: 'bar',
      label: 'Daily aiU',
      data: values,
      backgroundColor: '#34d39980',
      borderRadius: 3,
      order: 2,
    },
  ];

  if (showAverage) {
    datasets.push({
      type: 'line',
      label: '7-day average',
      data: avg,
      borderColor: '#6ee7b7',
      backgroundColor: 'transparent',
      tension: 0.3,
      pointRadius: 0,
      borderWidth: 2,
      order: 1,
    });
  }

  const config = {
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: showAverage, position: 'bottom', labels: { boxWidth: 10, boxHeight: 10 } },
        tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)} aiU` } },
      },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, grid: { color: '#21242b' } },
      },
    },
  };

  if (trendChart) {
    trendChart.data = config.data;
    trendChart.options = config.options;
    trendChart.update();
  } else {
    trendChart = new Chart(canvas, config);
  }
}

function renderQuickStats(stats) {
  const el = document.getElementById('quickStats');
  if (stats.eventCount === 0) {
    el.textContent = '';
    return;
  }

  const platforms = Object.entries(stats.byPlatform).sort((a, b) => b[1] - a[1]);
  const topPlatform = platforms[0];
  const ambient = stats.byCategory.ambient || 0;
  const ambientPct = stats.totalAiu > 0 ? Math.round((ambient / stats.totalAiu) * 100) : 0;

  const parts = [];
  if (topPlatform) parts.push(`Top source: <strong>${labelize(topPlatform[0])}</strong>`);
  parts.push(`<strong>${ambientPct}%</strong> ambient (not explicitly asked for)`);
  el.innerHTML = parts.join(' &nbsp;&middot;&nbsp; ');
}

// --- Persona rendering -----------------------------------------------------

const PERSONA_STYLES = {
  passive_recipient: { color: '#94a3b8', accent: '#64748b', rings: 1 },
  casual_user: { color: '#a78bfa', accent: '#7c3aed', rings: 2 },
  practitioner: { color: '#60a5fa', accent: '#2563eb', rings: 3 },
  power_user: { color: '#34d399', accent: '#059669', rings: 4 },
  orchestrator: { color: '#fbbf24', accent: '#d97706', rings: 5 },
};

// Abstract geometric avatar: a central node with N orbiting rings/nodes,
// where N grows with persona tier. Drawn as inline SVG — no image files,
// no network, scales cleanly, and matches the dark theme.
function personaAvatarSvg(personaKey, score) {
  const style = PERSONA_STYLES[personaKey] || PERSONA_STYLES.passive_recipient;
  const size = 96;
  const c = size / 2;
  const nodes = [];

  for (let i = 0; i < style.rings; i++) {
    const angle = (i / style.rings) * Math.PI * 2 - Math.PI / 2;
    const r = 32;
    const x = c + Math.cos(angle) * r;
    const y = c + Math.sin(angle) * r;
    nodes.push(
      `<line x1="${c}" y1="${c}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${style.accent}" stroke-width="1.5" opacity="0.55" />` +
        `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5.5" fill="${style.color}" />`
    );
  }

  // Progress arc around the outside, proportional to score.
  const arcR = 44;
  const circumference = 2 * Math.PI * arcR;
  const dash = (Math.max(0, Math.min(100, score)) / 100) * circumference;

  return `
    <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${personaKey} avatar">
      <circle cx="${c}" cy="${c}" r="${arcR}" fill="none" stroke="#21242b" stroke-width="3" />
      <circle cx="${c}" cy="${c}" r="${arcR}" fill="none" stroke="${style.color}" stroke-width="3"
              stroke-linecap="round" stroke-dasharray="${dash.toFixed(1)} ${circumference.toFixed(1)}"
              transform="rotate(-90 ${c} ${c})" />
      ${nodes.join('')}
      <circle cx="${c}" cy="${c}" r="11" fill="${style.color}" />
      <circle cx="${c}" cy="${c}" r="11" fill="none" stroke="#15171c" stroke-width="2" />
    </svg>`;
}

function renderPersona(stats) {
  const insights = stats.insights;
  const nameEl = document.getElementById('personaName');
  const blurbEl = document.getElementById('personaBlurb');
  const scoreEl = document.getElementById('personaScore');
  const avatarEl = document.getElementById('personaAvatar');
  const barsEl = document.getElementById('personaBars');

  if (!insights || stats.eventCount === 0) {
    nameEl.textContent = 'Not enough data';
    blurbEl.textContent = 'Use AI on a few different days and tools to build a profile.';
    scoreEl.textContent = '—';
    avatarEl.innerHTML = personaAvatarSvg('passive_recipient', 0);
    barsEl.innerHTML = '';
    return;
  }

  const { sophistication } = insights;
  const { persona, score, components, provisional, maturity } = sophistication;

  nameEl.innerHTML = provisional
    ? `${persona.name} <span class="persona-provisional">provisional</span>`
    : persona.name;

  let blurbText = persona.blurb;
  if (provisional) {
    const needs = [];
    if (maturity.needsActiveDays > 0) {
      needs.push(`${maturity.needsActiveDays} more active day${maturity.needsActiveDays === 1 ? '' : 's'}`);
    }
    if (maturity.needsEvents > 0) {
      needs.push(`${maturity.needsEvents} more event${maturity.needsEvents === 1 ? '' : 's'}`);
    }
    if (needs.length) {
      blurbText += ` Score is capped until there's more history — ${needs.join(' and ')} needed for a full rating.`;
    }
  }
  blurbEl.textContent = blurbText;

  scoreEl.textContent = score;
  avatarEl.innerHTML = personaAvatarSvg(persona.key, score);

  const labels = {
    breadth: 'Tool breadth',
    deliberateness: 'Deliberate use',
    consistency: 'Consistency',
  };
  barsEl.innerHTML = Object.entries(components)
    .map(
      ([key, value]) => `
      <div class="persona-bar-row">
        <span class="persona-bar-label">${labels[key] || key}</span>
        <span class="persona-bar-track"><span class="persona-bar-fill" style="width:${value}%"></span></span>
        <span class="persona-bar-value">${value}</span>
      </div>`
    )
    .join('');
}

function renderEffort(stats) {
  const insights = stats.insights;
  if (!insights) return;

  const { humanEquivalent, efficiency } = insights;
  document.getElementById('manDays').textContent = humanEquivalent.manDays.toFixed(2);
  document.getElementById('manHours').textContent =
    `${humanEquivalent.hours.toFixed(1)} hours of equivalent research & drafting`;
  document.getElementById('savedDays').textContent = efficiency.savedManDays.toFixed(2);
  document.getElementById('savedDetail').textContent =
    `${efficiency.savedHours.toFixed(1)} hours — reading is ~${efficiency.multiplier}× faster than writing from scratch`;
}

async function refresh() {
  try {
    const stats = await fetchStats(currentRange);
    document.getElementById('totalAiu').textContent = stats.totalAiu.toFixed(1);

    let countText = `${stats.eventCount} event${stats.eventCount === 1 ? '' : 's'} logged`;
    if (!CHART_AVAILABLE) {
      countText += ' — charts unavailable (vendor/chart.umd.js failed to load)';
    }
    document.getElementById('eventCount').textContent = countText;

    renderQuickStats(stats);
    renderPersona(stats);
    renderEffort(stats);

    if (CHART_AVAILABLE) {
      platformChart = renderDoughnut('platformChart', platformChart, stats.byPlatform, PLATFORM_COLORS);
      categoryChart = renderDoughnut('categoryChart', categoryChart, stats.byCategory, CATEGORY_COLORS);
      renderTrend(stats.trend);
    }
  } catch (err) {
    console.error(err);
    document.getElementById('eventCount').textContent = 'Could not load stats — is the backend running?';
  }
}

document.getElementById('rangePicker').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-range]');
  if (!btn) return;
  currentRange = btn.dataset.range;
  document.querySelectorAll('#rangePicker button').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  refresh();
});

document.getElementById('showAverage').addEventListener('change', (e) => {
  showAverage = e.target.checked;
  refresh();
});

refresh();
setInterval(refresh, 30000);
