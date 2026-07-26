# Submission checklist

Everything below is verified as of 26 July 2026, extension v0.5.0.

## Before you open the dashboard

- [ ] **Push the latest code**, including `PRIVACY.md` — the listing links to it,
      so it must be live on GitHub before you submit.
      ```bash
      cd ~/Desktop/Co-Work/ai-consumption-meter
      git add . && git commit -m "v0.5.0: privacy policy, store assets, icons" && git push
      ```
- [ ] **Confirm the privacy policy URL loads:**
      https://github.com/kharthiknarayanan-ai/ai-consumption-meter/blob/main/PRIVACY.md
- [ ] **Take screenshots** — see `README.md` in this folder. Back up your real
      data first, load `demo-data.json`, capture, then restore.
- [x] ~~Resolve the `decision` detection~~ — **done**, removed (see below).

## In the Developer Dashboard

**Package:** upload `ai-consumption-meter-v0.5.0.zip` from this folder.
Verified: `manifest.json` sits at the zip root, 21 files, 116 KB.

**Store listing** — all copy is in `listing-copy.md`:
- [ ] Item name: `AI Consumption Meter` (matches the manifest exactly)
- [ ] Summary (123/132 chars)
- [ ] Detailed description
- [ ] Category: **Productivity**
- [ ] Language: English
- [ ] Icon: `icon128-store.png`
- [ ] Screenshots at 1280×800

**Privacy practices tab:**
- [ ] Single purpose statement (in `listing-copy.md`)
- [ ] Justification for `storage`
- [ ] Justification for each of the 5 host permissions
- [ ] Justification for the optional `localhost` permission
- [ ] Privacy policy URL
- [ ] Data safety: answer **No** to every collection category
- [ ] Tick all three certifications

## Verified already

| Check | Result |
|---|---|
| Zero network calls in default config | The only `fetch` is the optional backend forward, gated behind a flag that defaults to false |
| Permissions match documentation | All 5 hosts + `storage` justified in both listing copy and privacy policy |
| No unexpected endpoints in code | None |
| Fresh-install path | 15 tests: cold service worker, empty storage, first event, device-ID creation, no false health warnings |
| Manifest name vs listing name | Aligned — both `AI Consumption Meter` |
| Version consistency | manifest `0.5.0` = package filename |
| No stale GitHub URLs | None |
| Syntax of all 21 shipped files | Clean |
| Zip structure | `manifest.json` at root (Chrome rejects nested folders) |

## Resolved: the `decision` detection

Checked against live Google markup on 26 July 2026 with the suggestions
dropdown open:

```js
{ listbox: false, options: 0, sample: [] }
```

Google's search box does not use the ARIA combobox pattern the code targeted,
so that detector could never have fired. It has been **removed**, along with
every user-facing mention of the Decision category (dashboard explainer,
README). The category remains in the data model as documented future work, but
nothing produces it and nothing claims otherwise.

This is why it was worth checking rather than shipping: the category was
described in the product UI, and would have sat permanently empty for every
user.

## After submission

Review typically takes a few days. Expect at least one round of questions —
extensions that read page content usually get scrutiny on the host permissions,
and the answer is the justification already written in `listing-copy.md`.

Once live, the Developer Dashboard gives install counts, weekly users, and
uninstalls broken down by country and version. That's your entire analytics
picture, and it requires no code and no data collection.
