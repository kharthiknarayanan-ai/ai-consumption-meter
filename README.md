# AI Intelligence Consumption Meter (AICM)

Like an electricity meter, but for how much AI-generated intelligence you consume day to day. A Chrome extension watches your ChatGPT, Claude, and Gemini web sessions, plus Google Search, logs each AI interaction as a "consumption event," and a local dashboard with real charts shows the running total in **aiU** (a rough, directional unit — not a precise measurement).

Three of the four consumption categories from the concept doc are implemented: `direct_query` (asking ChatGPT/Claude/Gemini something and using the answer as-is), `delegated_creation` (the same three platforms, but for long AI-generated replies you're more likely to actually use — currently a length-based heuristic, not real intent detection), and `ambient` (Google AI Overview — a synthesized answer you didn't explicitly ask for).

The fourth, `decision`, exists in the data model but **nothing currently produces it**. The original implementation targeted an ARIA combobox pattern Google's search box turns out not to use, so it could never fire; it was removed rather than shipped as a category that stays permanently empty. See the concept doc for the full long-term vision.

## What's in here

```
ai-consumption-meter/
├── extension/     The whole product — Chrome extension (Manifest V3),
│                  local storage, and bundled dashboard. Self-contained.
├── backend/       OPTIONAL. Node server keeping a raw event log, for people
│                  who want one. Off by default; not needed.
└── docs/          Concept doc and architecture designs
```

**The extension is standalone.** No server, no account, no API keys, no terminal. Data lives in `chrome.storage.local` as daily rollups and the dashboard is a bundled extension page. In its default configuration the extension makes **zero network requests** — Chart.js is bundled, and there is nothing to phone home to.

The Node backend is an advanced extra for keeping a raw per-event log alongside the extension's own store. It's disabled unless you turn it on, and the extension works fully without it.

## Install

Nothing to build, nothing to run.

1. Open Chrome and go to `chrome://extensions`
2. Turn on **Developer mode** (top-right toggle)
3. Click **Load unpacked** and select the `extension/` folder
4. Pin the extension so you can see today's reading at a glance

The dashboard opens automatically on first install.

## Use it

Have a normal conversation on `chatgpt.com`, `claude.ai`, or `gemini.google.com`. About 1.5 seconds after each AI reply finishes, the extension records it — the count ticks up in the popup, and the full breakdown is in the dashboard.

Search something on `google.com` that triggers an AI Overview (question-style searches work best) and that's recorded too, as `ambient` rather than `direct_query` — you didn't ask for it, it just showed up.

The dashboard shows your AI usage profile (persona + sophistication score with a generated avatar), human-equivalent effort in man-days, doughnut charts for platform and category breakdown, a 14-day trend with optional 7-day average, and controls to export or delete everything.

## Optional: the raw event log

The extension is complete on its own. If you also want a per-event log and a separate server-rendered dashboard:

```bash
cd backend
npm install
npm start          # http://localhost:4141
```

Then enable forwarding by setting `aicm_backend_enabled` to `true` in the extension's storage. This requires granting the optional `localhost` permission. Most people should skip this.

## How consumption is measured

Every logged AI reply gets weighted into **aiU**:

```
aiU = max(0.1, (characters in the reply / 500) × category multiplier)
```

Category multipliers: `direct_query` = 1, `delegated_creation` = 1.2, `ambient` = 0.3. (`decision` = 0.5 exists in the model but nothing produces it — see above.)

`delegated_creation` is currently decided by a simple length heuristic: any ChatGPT/Claude/Gemini reply of 800+ characters is logged as `delegated_creation` instead of `direct_query`, on the assumption that a long reply is more likely to be drafted content you'll actually reuse than a quick answer. It's not based on what you actually did with the reply (copy, publish, ignore) — that would need copy/export-action detection, which isn't built yet.

This is intentionally a rough proxy, the same way "1 kWh" doesn't tell you anything about which appliance used it — the point is to make an invisible pattern visible over time, not to produce a scientifically precise number.

## Human-equivalent effort and efficiency

The dashboard converts total AI output into a **man-days** figure and a **time-not-spent-producing** figure. Both rest on stated assumptions in `backend/insights.js`:

- Producing researched, considered prose from scratch: **~3,000 characters/hour** (roughly 500 words/hour — the rate for non-trivial writing, not raw typing speed).
- Reading and evaluating text: **~15,000 characters/hour** (~250 wpm).
- A work day is **8 hours**.

So "0.95 man-days" means *the volume of text you consumed would have taken about 0.95 days to write yourself* — it does **not** mean you saved 0.95 days, because it assumes you'd have produced all of it, at that quality, unaided. The efficiency multiplier (5×) is just the ratio of those two constants: it's a fact about reading being faster than writing, not a personal performance metric. Change the constants at the top of `insights.js` if your work has a different profile.

## The AI usage profile (persona)

The dashboard assigns a persona — Passive Recipient, Casual User, Practitioner, Power User, Orchestrator — from a 0–100 **sophistication score**. Deliberately **not** volume-based. The score combines:

- **Tool breadth** (25%) — using several tools suggests picking per task rather than defaulting to whatever's open.
- **Deliberate use** (45%) — the share of consumption actively requested (`direct_query`, `delegated_creation`) versus passively received (`ambient`). A high ambient share pushes this **down**.
- **Consistency** (30%) — using AI across many distinct days, with full marks at roughly half the days in the window (daily use isn't inherently better than every-other-day use).

Sending more messages does not raise your score. A heavy user whose consumption is almost all passive search summaries scores *lower* than a light user making deliberate, multi-tool queries — which matches this project's founding premise that unnoticed AI consumption is the thing worth watching.

**Maturity gate:** below 5 active days or 25 events, the score is capped at 74 and labelled *provisional*, and the top two tiers are unreachable. Without this, consistency is trivially 100% for a brand-new user (they've used it every day they've had data), so anyone would rank top-tier on day two.

### On using this to assess someone else

This was built with a recruiter-style "how good is this candidate with AI?" use case in mind, so, plainly: **it is not fit for that purpose on its own.** It measures the shape of someone's *consumption*, and consumption is not competence. It cannot tell whether the output was any good, whether the person used it, whether they understood it, whether they verified it, or whether they could have done the work themselves. It's trivially gameable by anyone who knows the formula. And it only sees four websites in one browser on one machine.

What it can reasonably support is *self-reflection* ("most of my AI intake is passive — is that what I want?") or, at most, a conversation-starter someone chooses to share about their own habits. Treating a number from this tool as evidence about a candidate would be a misuse of it, and the caveat is printed on the dashboard itself for the same reason.

## Detection health (how you find out when it breaks)

These content scripts depend on the markup of sites nobody here controls, and that markup changes without notice. The extension watches its own detection and tells you when something looks wrong, rather than failing silently.

Each supported site records a local "visit" on page load and a "match" on successful detection. If a platform accumulates several visits **across at least two different days** with no successful detection, the popup shows a warning and offers a "Report this" link that opens a prefilled GitHub issue.

The two-day requirement exists to avoid false alarms — opening a chat site a few times in one sitting without sending anything is normal, while a genuine markup break persists across days. A false warning is worse than a slow one in a tool whose whole value is being believed.

**None of this is transmitted anywhere.** Health counters live in `chrome.storage.local`, the extension notices its own breakage and tells *you*, and the GitHub issue contains only the extension version and which platform failed — no usage data, and you see it before deciding to submit it.

## Known limitations (read before reporting a "bug")

The DOM selectors this relies on (`chatgpt.js`, `claude.js`, `gemini.js`, `google-search.js`) are tied to each site's current markup. If OpenAI, Anthropic, or Google change their UI, detection stops working — the popup should warn you (see above), and the fix is to update the selector constant in the relevant content script. `google-search.js` is the most fragile of the four: its selector is a minified, obfuscated Google class name (`.iNqyIf`) rather than a semantic `data-testid` or custom element tag, so it's the most likely to break first.

Nothing currently produces the `decision` category. `delegated_creation` is inferred from reply length, not from what you actually did with the reply.

There's no "self-authored vs. AI-assisted" ratio, since that would require measuring how much you wrote yourself.

Only this browser, on this device, is measured. It's a sample of your AI use, not a complete record.

## Roadmap (not built yet)

A working `decision` source (the Google autocomplete attempt was removed — see above; Gmail Smart Reply is a more promising target). Real `delegated_creation` detection via copy/export actions, replacing the length heuristic. More ambient sources. Firefox and Safari ports. Copilot and Perplexity. A "cognitive independence" ratio. Cross-device sync — see `docs/ecosystem-architecture.md`.

## Publishing to GitHub

Run these on your own machine, from inside the `ai-consumption-meter` folder:

```bash
# Clean up two leftover build artifacts first
rm -rf .git package-lock.json      # empty root lockfile; the real one is in backend/

git init
git add .
git status                          # confirm backend/data/events.json is NOT listed
git commit -m "AI Intelligence Consumption Meter v0.5.0 — self-contained extension"
git branch -M main

# With the GitHub CLI:
gh repo create ai-consumption-meter --public --source=. --push

# Or create an empty repo on github.com first, then:
git remote add origin https://github.com/kharthiknarayanan-ai/ai-consumption-meter.git
git push -u origin main
```

The `git status` check matters: `backend/data/events.json` is your own AI usage
history and is gitignored, but it's worth confirming before the first push.
