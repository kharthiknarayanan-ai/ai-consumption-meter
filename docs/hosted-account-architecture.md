# AICM v4 — Hosted Accounts & Individual Usage Records

Status: design, not built. Decisions recorded 2026-07-26.

This document covers storing per-user AI consumption on a server the operator can read — enabling hosted profiles, cross-device history without key management, and population statistics derived from real records.

It supersedes nothing. The E2E relay from `ecosystem-architecture.md` remains a supported mode; this adds a second, more capable mode with materially different obligations.

## The tradeoff being made, stated plainly

The E2E relay is private *by construction* — the operator cannot read events even under subpoena, because it holds only ciphertext. Hosted accounts are private *by policy* — the operator can read everything and chooses not to misuse it. Policy is weaker than construction. That's not an argument against building it; it's the thing that determines what else must be built alongside it.

Concretely, this design makes the operator a **data controller** holding behavioural records derived from reading users' AI chat pages. That triggers obligations that are not optional and not deferrable to "later":

- A lawful basis for processing, documented before collection starts.
- Working export and deletion endpoints (not a support email address).
- Consent records with timestamps and versioned policy text.
- A retention policy that actually deletes things.
- Breach notification capability within 72 hours.
- An EU representative if EU users are served from outside the EU.

Pseudonymisation does **not** exempt any of this — hashed user IDs are still personal data under GDPR Art. 4(5).

## Three modes, user-selected

Rather than replacing the local-first design, offer a ladder. The mode is chosen at setup and changeable later, with data migration between modes.

| Mode | Server sees | Cross-device | Recovery | Who it's for |
|---|---|---|---|---|
| **Local only** (default) | Nothing — no network calls | No | N/A | Privacy-maximalists; also the safest store submission |
| **E2E sync** | Opaque ciphertext | Yes | None — lost passphrase is lost data | Technical users wanting sync without trust |
| **Hosted account** | Everything | Yes | Password reset | Users wanting convenience, shareable profiles, no key management |

Defaulting to local-only matters for more than ethics: it's the configuration that makes the Chrome Web Store listing simplest, and it means the majority of users generate no liability at all.

## Data model

### Server schema (Postgres)

```sql
users (
  id              uuid primary key,
  email           citext unique not null,
  password_hash   text not null,          -- Argon2id
  created_at      timestamptz not null,
  region          text,                   -- coarse: country only, for residency + stats
  deleted_at      timestamptz             -- soft delete, hard-purged by retention job
)

devices (
  id              uuid primary key,
  user_id         uuid references users on delete cascade,
  label           text,                   -- user-supplied, e.g. "work laptop"
  platform        text,                   -- chrome | firefox | macos_agent
  last_seen_at    timestamptz
)

-- NOTE: daily rollups, not raw events. See "Minimisation" below.
usage_daily (
  user_id         uuid references users on delete cascade,
  device_id       uuid references devices on delete set null,
  day             date not null,
  platform        text not null,          -- claude | chatgpt | gemini | google_search
  category        text not null,          -- direct_query | delegated_creation | ...
  signal_type     text not null,          -- chars | time
  event_count     int not null,
  total_chars     bigint,
  total_active_ms bigint,
  aiu             numeric(10,2) not null,
  primary key (user_id, day, platform, category, signal_type, device_id)
)

consents (
  id              uuid primary key,
  user_id         uuid references users on delete cascade,
  purpose         text not null,          -- 'service' | 'aggregate_stats' | 'marketing'
  granted         boolean not null,
  policy_version  text not null,
  occurred_at     timestamptz not null,
  ip_hash         text                    -- proof of consent, salted hash not raw IP
)

deletion_requests (
  id, user_id, requested_at, completed_at, method  -- auditable DSAR trail
)
```

### Minimisation is the main safety lever

**Store daily rollups, not individual events.** The client aggregates locally and uploads one row per (day, platform, category) instead of one row per AI reply. This is the single highest-leverage decision in the design:

- A breach exposes "this person used Claude heavily on these days," not a timeline of every interaction.
- Storage and cost drop by orders of magnitude.
- Every product feature described so far (dashboard, trends, persona, man-days) works fine on daily rollups. Nothing is lost.
- It measurably reduces what a subpoena can compel.

If a future feature genuinely needs per-event granularity, that's the moment to revisit — not before.

### Two things that must never reach the server

**Fingerprints.** The dedup fingerprint is derived from the first 200 characters of AI output. Sent to a server the operator can read, it becomes a content-inference vector: an attacker with a corpus of common AI responses could rainbow-table it to learn what was asked. In hosted mode, dedup must happen client-side only, and the fingerprint column must not exist in the server schema. (In E2E mode this is a non-issue, since the server sees only ciphertext.)

**Prompt or reply text.** The extension already only measures lengths, never content. That property must be enforced at the API boundary — the server should reject any payload carrying a text field, rather than trusting clients not to send one.

## Aggregate statistics layer

"How much does the world use AI" is answered from a derived table, never by querying user rows.

```
usage_daily  ──nightly job──▶  population_stats
                               (bucketed, k-anonymised, no user_id)
```

Rules:

- **k-anonymity threshold**: no cell published where the contributing user count is below ~50. Small countries and rare platform combinations get bucketed into "other" rather than published thin.
- **Buckets, not values**: publish distribution buckets and percentiles, never raw per-user figures.
- **Separate consent**: contributing to aggregate stats is its own opt-in (`purpose = 'aggregate_stats'`), independent of the account itself. A user can have a hosted account and refuse to be counted in statistics. Bundling these into one checkbox is the kind of thing that invalidates consent under GDPR.
- **Coarse geography only**: country level. City or IP-derived location adds re-identification risk for negligible analytical value.

## API surface

```
POST   /v1/auth/register          → creates user + service consent record
POST   /v1/auth/login             → session token
POST   /v1/devices                → register device, returns device_id
POST   /v1/usage                  → idempotent upsert of daily rollups
GET    /v1/usage?from=&to=        → user's own data
GET    /v1/export                 → GDPR Art. 15/20 — full JSON, all tables
DELETE /v1/account                → GDPR Art. 17 — hard delete, cascades, logged
POST   /v1/consent                → grant/withdraw by purpose, versioned
GET    /v1/stats/population       → public aggregate endpoint, k-anonymised
```

`POST /v1/usage` is an upsert keyed on the rollup primary key, so a client re-uploading the same day is idempotent — the same property that makes the offline queue safe to retry.

`DELETE /v1/account` must genuinely delete, including from backups within the documented window. A soft-delete flag that leaves rows recoverable indefinitely is not Art. 17 compliance and is the most common way products fail an audit.

## Security posture

The threat model changes the moment the server can read events. Baseline requirements:

- Argon2id password hashing; TLS everywhere; encryption at rest.
- Rate limiting on auth endpoints; generic error messages to prevent account enumeration.
- Admin access to user data behind audit logging — every read of a user's rows recorded with actor and reason. If nobody can query production freely, an insider-misuse story becomes detectable.
- Subprocessor DPAs (hosting, email, error tracking). Error trackers are a frequent accidental leak of personal data via stack traces and request bodies — scrub payloads.
- Automated retention job: purge `usage_daily` older than the published retention window (24 months is a defensible default), purge soft-deleted accounts after 30 days.

## Chrome Web Store compliance checklist

Enforcement of the updated Limited Use policy begins **1 Aug 2026**, and applies to extensions already listed, not only new submissions.

- [ ] **Single purpose declared** and data collection strictly necessary to it. The purpose must be user-facing: *"measure your AI consumption and sync it to your account"* — not *"help us understand global AI usage."*
- [ ] **Prominent disclosure** in both the store listing and the extension UI, before any transmission occurs.
- [ ] **Affirmative consent** at setup — hosted mode must be actively chosen, never the default.
- [ ] **Privacy policy** published, linked, and versioned; consent records reference the version.
- [ ] **No collection beyond purpose** — in particular, no general browsing history, and no data gathered for unreleased features.
- [ ] **Data safety form** completed accurately in the Developer Dashboard.
- [ ] Local-only mode remains fully functional, so users who decline transmission still get the product.

**Sequencing recommendation:** submit v1 as local-only (no transmission, minimal review surface, establishes account standing), then submit the hosted-account version once the compliance package above is genuinely complete rather than promised.

## Open risks

- **Policy-not-construction privacy.** Users who chose this product for its local-first story may reasonably feel differently about a hosted mode existing at all. Keeping local-only as the default and being explicit in the README is the mitigation.
- **The recruiter/employer path.** A hosted profile a user chooses to share is defensible. An employer-facing dashboard over the same records is a materially different product — different consent basis (employment relationships complicate voluntary consent), different scrutiny, plausibly different regulator interest. Worth deciding deliberately rather than arriving at by feature drift.
- **Aggregate stats are a re-identification surface.** Even bucketed data leaks under repeated querying or with rare attribute combinations. The k-threshold and coarse geography are the defence; they need enforcing in code, not convention.
- **Breach blast radius.** Currently zero — there's no server holding anything. After this, a breach exposes behavioural profiles of every hosted user. Daily rollups plus a real retention window are what keep that bounded.
- **Jurisdictional scope creep.** Serving EU users triggers GDPR and likely an Art. 27 representative; California triggers CCPA/CPRA; India's DPDP Act has its own consent-notice requirements. "Available worldwide" is a compliance decision, not just a distribution setting.
