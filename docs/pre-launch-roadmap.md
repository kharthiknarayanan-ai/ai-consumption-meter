# Pre-Launch Roadmap

What stands between the current build and a Chrome Web Store submission. Written 2026-07-26.

## Where things actually stand

**Working:** ChatGPT, Claude, and Gemini detection (`direct_query`, plus `delegated_creation` by length heuristic); Google AI Overview (`ambient`); local dashboard with charts, persona scoring, and man-day estimates; multi-device event schema; persistent fingerprint dedup; local self-diagnosis with popup warnings.

**The blocker:** the extension depends on a Node server the user has to start themselves. Nothing else on this list matters until that's gone.

---

## P0 — Blocks submission

### 1. Make the extension self-contained
**The single most important item.** Today the extension is unusable by anyone who won't open a terminal.

- Move the event store from the Node backend into `chrome.storage.local`.
- Port the dashboard to a bundled extension page (`chrome-extension://<id>/dashboard.html`) — same HTML/CSS/JS, reading from extension storage instead of `fetch('/api/stats')`.
- Move `aiu.js`, `insights.js`, and the stats aggregation into shared extension-side modules. The logic is already pure functions, so this is mostly relocation rather than rewriting.
- Keep the Node backend as an **optional** advanced feature ("export to a local server"), off by default and documented separately.

Side benefit worth noting: an extension that makes **zero network calls** is the easiest possible Limited Use review. It also makes the privacy policy nearly trivial to write, because the honest answer to every question becomes "no data leaves your browser."

Storage note: `chrome.storage.local` defaults to ~10MB, which is ample for daily rollups but not for unbounded raw events. Store daily rollups plus a capped recent-event window, and prune on write.

### 2. Create the GitHub repo
**Done.** Repo is live at `github.com/kharthiknarayanan-ai/ai-consumption-meter` with MIT LICENSE, issue templates, and CONTRIBUTING. The popup's "Report this" link now resolves. (Worth noting how this nearly shipped broken: the URL was guessed from an email address and the real username turned out to be `kharthiknarayanan-ai` — the link 404'd until it was checked against the actual remote.)

### 3. Resolve the unverified `decision` detection
Google autocomplete tracking was written against an assumed ARIA pattern and has never been confirmed to fire. Either verify it works and keep it, or remove it before launch. Shipping a feature that silently does nothing is the kind of thing that produces confused reviews you can't debug.

### 4. Privacy policy + data safety declaration
Required regardless of how little you collect. Must be publicly hosted (GitHub Pages is fine), linked from the listing, and versioned. The Chrome Web Store data safety form must match it exactly — mismatches are a common rejection cause.

### 5. Single-purpose statement
One sentence, used consistently in the listing, the manifest description, and the policy: *"Measure how much AI-generated content you consume, and show it to you locally."* Every permission must trace back to it. Reviewers check that `host_permissions` are justified by the stated purpose.

### 6. First-run experience
Currently: install, open popup, see zeros with no explanation. Needs a short onboarding — what the extension does, which sites it watches, what aiU means, where the data lives (and doesn't go), and a nudge to go use an AI tool so something appears.

### 7. Store listing assets
- Icon at 128×128 (current programmatically-generated one is serviceable but plain; worth a proper pass).
- 1–5 screenshots at 1280×800 — the dashboard and persona card are the strong visuals here.
- Short description (132 char limit) and full description.
- Category and language selections.

### 8. Fresh-profile testing
The extension has only ever run on your machine, with your data, alongside a running backend. Test a clean Chrome profile, brand-new install, no backend, no prior storage — the exact path every real user takes. Expect to find at least one thing that only worked because of local state.

---

## P1 — Strongly recommended before launch

**Data controls.** Export-my-data (JSON download) and clear-all-data buttons. Cheap to build, and they answer the first question a privacy-conscious user asks. Also pre-empts most "how do I reset this" support requests.

**In-product explanation of aiU and the persona.** Right now the reasoning lives in a README nobody installing from the store will read. The dashboard needs a short inline "what am I looking at" — especially the persona caveat, which currently only exists in the footnote.

**Storage-quota handling.** Decide and implement behaviour when `chrome.storage.local` fills: prune oldest, warn, or both. Silent write failures would corrupt totals invisibly.

**Version-upgrade path.** When a user updates and the stored schema changes, migrate on read (the pattern already used server-side). Without it, an update could zero someone's history — the worst possible bug for a tool whose value is accumulated history.

**Uninstall URL.** `chrome.runtime.setUninstallURL()` pointing at a short feedback form. This is your main signal for *why* people leave, and it costs almost nothing.

---

## P2 — After launch

Firefox and Safari ports (near-identical code, real coverage gain, no new architecture). Real `delegated_creation` detection via copy/export actions rather than the length heuristic. More ambient and decision sources. Desktop agents. E2E sync. Hosted accounts.

---

## Suggested sequence

**Phase A — make it shippable.** Items 1, 2, 3. This is the bulk of the engineering, and item 1 dominates it.

**Phase B — make it presentable.** Items 6, 7, plus the P1 data controls and in-product explanation.

**Phase C — make it submittable.** Items 4, 5, 8. Compliance paperwork and clean-room testing, best done last when the product has stopped moving.

Phase A is the real work. B and C are mostly writing, assets, and careful checking — but C in particular shouldn't be rushed, since a rejection costs days of round-trip and the Limited Use policy is being actively enforced from 1 Aug 2026.

## What I'd cut

Nothing in P0. From P1, the uninstall URL and storage-quota handling could slip to a fast-follow update if you want to launch sooner — neither is user-visible on day one, and both are small enough to add without friction later.
