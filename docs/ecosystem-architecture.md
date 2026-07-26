# AICM v3 — Multi-Device Ecosystem Architecture

Status: design, not built. Decisions recorded 2026-07-26.

Today AICM is one Chrome extension talking to one Node process on one machine. This document covers what changes to make it a meter that follows a person across browsers, desktops, and (eventually) phones — and, just as importantly, what it will never be able to see.

## The three decisions this design rests on

1. **Sync is an end-to-end encrypted relay.** Devices encrypt events locally; the server stores ciphertext it cannot read. The "we can't see your data" claim stays literally true.
2. **Mobile is deferred.** Desktop agents and browser extensions first. The reasons are platform constraints, not effort estimates — see the capability matrix.
3. **Signals stay separated by type.** Character-based measurement (browser) and time-based observation (native) are reported as distinct tracks with distinct confidence, never silently summed.

## What each platform can actually observe

This is the load-bearing section. Everything else follows from it.

| Surface | What's observable | Mechanism | Confidence | Constraint |
|---|---|---|---|---|
| Chrome / Edge / Firefox | Full reply text length | Content script + DOM | **Measured** | Selector fragility (already known) |
| Safari (macOS/iOS) | Full reply text length | Safari Web Extension | **Measured** | Requires Xcode packaging, Apple dev account |
| macOS desktop apps | Window title, focus duration, sometimes text via AX tree | Accessibility API (`AXUIElement`) | **Inferred** (time) or Measured (if AX exposes text) | Needs user-granted Accessibility permission; Electron apps vary in AX richness |
| Windows desktop apps | Same, via UI Automation | UIA / `IUIAutomation` | **Inferred** / Measured | Needs elevated-ish trust; AV false positives common |
| Linux desktop | Window title + focus time | X11/Wayland APIs (Wayland much more restricted) | **Inferred** | Wayland deliberately blocks cross-app introspection |
| Android apps | Screen content readable | `AccessibilityService` | **Inferred**/Measured | Play Console declaration + in-app disclosure + affirmative consent required; stricter review since 28 Jan 2026; suspension/account-termination risk for undeclared use; Advanced Protection Mode can disable it |
| iOS apps | **Nothing usable** | — | — | Screen Time/`DeviceActivity` report data is sandboxed in an extension that cannot pass values to the host app. You may render Apple's view; you cannot read it. No content access, no extractable usage numbers. |

**The iOS row is the reason mobile is deferred.** It isn't a matter of effort — the platform structurally prevents the aggregation this product needs. The only honest iOS paths are the Safari web extension (covers web AI use only) and deliberate user-initiated logging via a Share Sheet extension or Shortcuts. Both are opt-in and partial; neither is passive tracking.

## Architecture

```
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│ Browser ext     │   │ Desktop agent   │   │ (later) Android │
│ Chrome/FF/Safari│   │ macOS / Windows │   │ Accessibility   │
└────────┬────────┘   └────────┬────────┘   └────────┬────────┘
         │ measured (chars)     │ inferred (time)      │
         └──────────┬───────────┴──────────────────────┘
                    ▼
         ┌──────────────────────┐
         │  Local agent (per    │  ← keeps working fully offline
         │  device): queue,     │
         │  dedup, encrypt      │
         └──────────┬───────────┘
                    │ ciphertext only
                    ▼
         ┌──────────────────────┐
         │  Sync relay          │  ← sees: user_id, blob, ts, device_id
         │  (blind store)       │     never sees: platform, content, aiU
         └──────────┬───────────┘
                    ▼
         ┌──────────────────────┐
         │  Any device: decrypt │
         │  → local dashboard   │
         └──────────────────────┘
```

### Local-first stays the default

Every device keeps a full local store and a working dashboard with no network. Sync is additive. If the relay is unreachable, unavailable, or the user never enables it, the product still works exactly as it does today. This preserves the current guarantee and means the relay is never a single point of failure.

### The relay is deliberately dumb

It accepts `{user_id, device_id, seq, ciphertext, created_at}` and hands back rows since a cursor. It performs no aggregation, no analytics, and cannot — the payload is opaque to it. This makes it cheap to run, trivial to self-host, and uninteresting to breach.

Key derivation: passphrase → Argon2id → symmetric key, generated and held only on device. **A lost passphrase means unrecoverable data**, and the UI must state that plainly before enabling sync, since users reasonably expect account recovery and this cannot provide it.

## Event schema changes

Current shape:

```json
{ "id": 1, "platform": "claude", "category": "direct_query",
  "outputLength": 1200, "aiu": 2.88, "timestamp": 1784830894243 }
```

Multi-device shape:

```json
{
  "id": "uuid-v7",
  "deviceId": "macbook-air-a1b2",
  "source": "browser_extension",
  "signalType": "chars",
  "confidence": "measured",
  "platform": "claude",
  "surface": "web",
  "category": "direct_query",
  "outputLength": 1200,
  "activeMs": null,
  "aiu": 2.88,
  "fingerprint": "sha256:...",
  "timestamp": 1784830894243,
  "schemaVersion": 2
}
```

New fields and why each exists:

- **`deviceId`** — attribution, and required for dedup and per-device breakdowns.
- **`source`** — `browser_extension` | `desktop_agent` | `mobile_agent` | `manual`. Distinguishes *how* we know, which the persona score should weight.
- **`signalType`** — `chars` | `time`. Prevents the category error of adding minutes to characters.
- **`confidence`** — `measured` | `inferred` | `self_reported`. Surfaced in the UI; filterable.
- **`activeMs`** — populated for time-signal events, `null` for char events (and vice versa for `outputLength`).
- **`fingerprint`** — idempotency key for dedup (below).
- **`schemaVersion`** — existing v1 events get `1` and are migrated on read, not rewritten in place.

### The dedup problem is real and non-obvious

ChatGPT, Claude, and Gemini all sync conversation history across devices. Open the same thread on your laptop and then your phone and a naive implementation logs the same 2,000-character reply twice. Scrolling back through old chats would re-log everything you've ever read.

Mitigations, layered:

1. **Content fingerprint** — `sha256(platform + normalized_first_200_chars + normalized_length)`. Same reply seen on two devices produces one fingerprint; the relay-side merge keeps the earliest by timestamp.
2. **Already-seen marking** — the current `data-aicmLogged` attribute is per-page-load and per-device. It needs to become a persistent local set of fingerprints so revisiting an old chat doesn't re-log it.
3. **Cross-signal suppression** — if a desktop agent reports 12 minutes in the Claude app while the browser extension reports measured character events in the same window, prefer the measured signal and discount the inferred one, rather than counting both.

Point 2 is worth flagging: **the current single-device build already has this bug.** Scrolling back through an old conversation re-triggers detection on replies it logged in a previous session, because `data-aicmLogged` lives on a DOM node that's destroyed on reload. Worth fixing regardless of whether the ecosystem gets built.

## Dual-signal reporting

The dashboard grows a second track rather than one blended number:

- **Measured consumption** — aiU from character counts. The existing headline figure.
- **Observed AI time** — minutes of focused use in AI applications, from native agents. Reported in minutes, never converted into aiU.

They can sit side by side and be compared, but they are never summed, and the persona/sophistication score should draw primarily on measured events, treating inferred time as a breadth signal only ("you also use the Claude desktop app") rather than as volume.

Rationale: converting time→characters would require assuming a reading speed, then assuming an active-vs-idle ratio, then stacking that on top of the existing chars→aiU assumption. Three layers of estimate presented as one number is how a directional tool starts getting mistaken for a measurement.

## Build sequence

**Phase 1 — schema and dedup (no new surfaces).** Refactor the event model to the shape above, add persistent fingerprint-based dedup, migrate existing events, keep everything single-device. Ships a real bug fix and unblocks everything else. *Small, self-contained, no new platforms.*

**Phase 2 — browser breadth.** Port the extension to Firefox (near-identical, MV3 with minor manifest differences) and Safari (Xcode wrapper, Apple developer account). Edge is Chromium and works as-is. Highest coverage gain per unit of effort, no new architecture.

**Phase 3 — sync relay.** Build the blind relay, on-device crypto, passphrase flow, and conflict/merge logic. Self-hosting docs from day one. This is the largest single chunk and the one with the most ways to get quietly wrong (key management, replay, clock skew).

**Phase 4 — desktop agents.** macOS first (AX API, cleaner permission model, likely your own daily driver), Windows second. Time-signal only at first; attempt AX text extraction as an enhancement.

**Phase 5 — mobile, reassessed.** Revisit only with real data on what the coverage gap actually is. Android via declared AccessibilityService if it still looks worth the review risk; iOS as Safari extension plus deliberate Shortcuts logging, with honest messaging that iOS coverage is partial by Apple's design.

## Open risks

- **Passphrase loss is unrecoverable.** Non-negotiable consequence of the encryption choice. Needs blunt UI copy and an export-your-key flow.
- **Android review risk is material.** Declared or not, accessibility-based tracking apps attract scrutiny, and the penalty ceiling is developer-account termination. Worth a policy pre-check before writing the app, not after.
- **Desktop agents are the highest-trust component** — a background process reading window contents. This needs to be open-source, signed, and narrowly scoped, or it's indistinguishable from spyware in the user's mind (and in a security researcher's).
- **The ecosystem multiplies selector fragility.** Four sites × five surfaces is a lot of independently breaking things. Consider a remotely-updatable selector config (fetched, signed, cacheable) so a Google markup change doesn't require shipping new binaries to every platform.
- **Scope honesty.** Even fully built, this sees consenting devices with the agent installed, in supported apps. It is a *sample* of AI consumption, not a census — and the more surfaces it covers, the more tempting it becomes to forget that.
