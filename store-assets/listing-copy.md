# Chrome Web Store listing copy

Everything here must stay consistent with the manifest description, the privacy
policy, and the Data Safety form. Reviewers check these against each other, and
mismatches are a common rejection cause.

---

## Item name (45 char limit)

```
AI Consumption Meter
```
*(20 chars. "AI Intelligence Consumption Meter" is 32 and also fits, but the
shorter version truncates better in search results and the toolbar tooltip.)*

---

## Short description / summary (132 char limit)

```
See how much AI-generated content you consume each day. Measured privately in your browser — nothing is ever sent anywhere.
```
*(122 chars)*

---

## Single purpose statement

Required field. Must be one purpose, and every permission must trace back to it.

```
Measure how much AI-generated content the user consumes on supported AI websites, and display that measurement to them locally.
```

---

## Detailed description

```
An electricity meter shows you power you'd never otherwise notice using. This does the same thing for AI.

Every day you read AI-generated text — answers from ChatGPT, Claude, or Gemini, and search summaries you never asked for. Individually each one is forgettable. Added up over a month, most people have no idea how much of what they read was written by a machine.

This extension counts it, and shows you.


WHAT IT MEASURES

• Conversations on ChatGPT, Claude, and Gemini
• Google's AI Overviews — the summaries that appear above search results
• Nothing else

Only the LENGTH of what AI produces is measured. The extension never stores, reads, or transmits the content of your conversations.


WHAT YOU SEE

• A daily reading in "aiU" — a rough unit, roughly 500 characters of AI output
• Breakdown by which tool, and by whether you asked for it or it just appeared
• A 14-day trend with a 7-day average
• An estimate of how long that volume of text would have taken to write yourself
• A usage profile scored on HOW you use AI, not how much


ABOUT THE PROFILE

Sending more messages does not raise your score. It's based on the breadth of tools you use, how much of your intake was deliberate rather than passive, and how consistently you use AI over time. Someone whose consumption is mostly ambient search summaries scores lower than someone making fewer, more deliberate queries.

The point is self-awareness, not a high score.


PRIVACY

There is no server. There is no account. There are no analytics.

In its default configuration this extension makes no network requests at all. Your data is stored in your own browser and never leaves it. You can export it as JSON or delete all of it at any time, from a button in the dashboard.

The full source is available, so you can verify all of this rather than take our word for it:
https://github.com/kharthiknarayanan-ai/ai-consumption-meter


WHAT IT CAN'T TELL YOU

It measures consumption, which is not the same as competence. It can't tell whether AI output was correct, whether you used it, whether you checked it, or whether you could have done the work yourself. The numbers are estimates built on stated assumptions — useful for spotting your own patterns, not for judging anyone.

It also only sees the four websites listed above, in this browser. It is a sample of your AI use, not a complete record.
```

---

## Permission justifications

Each must be answered in the Developer Dashboard.

**`storage`**
```
Stores the user's own consumption measurements locally in their browser. This is
the extension's entire function — there is no server, so local storage is the
only place the data exists.
```

**Host permissions — `chatgpt.com`, `chat.openai.com`, `claude.ai`, `gemini.google.com`, `www.google.com`**
```
The extension measures the length of AI-generated responses on exactly these
sites. A content script reads the length of completed AI replies (and, on
google.com, AI Overview summaries) to compute a local total. No page content is
stored or transmitted. These five sites are the complete set the extension
supports; no other host access is requested.
```

**Optional host permission — `http://localhost:4141/*`**
```
Not used by default and not granted at install. Advanced users running the
project's open-source local companion server may opt in, which mirrors events to
software on their own machine. Nothing is sent to any remote server.
```

---

## Data safety form answers

| Question | Answer |
|---|---|
| Does this item collect or use personally identifiable information? | No |
| Health information? | No |
| Financial and payment information? | No |
| Authentication information? | No |
| Personal communications? | **No** — only the character *length* of AI responses is measured. No message content is read, stored, or transmitted. |
| Location? | No |
| Web history? | **No** — the extension does not record browsing history. It records that an AI response of a given length occurred on one of five supported sites. |
| User activity? | **No** — no clickstream, keystroke, or activity monitoring. |
| Website content? | **No** — content is never stored or transmitted. |

**Certifications required:**
- ☑ I do not sell or transfer user data to third parties, outside of approved use cases
- ☑ I do not use or transfer user data for purposes unrelated to my item's single purpose
- ☑ I do not use or transfer user data to determine creditworthiness or for lending purposes

All three are truthful: in its default configuration the extension transmits no
data anywhere.

---

## Category

**Primary:** Productivity
**Alternative:** Workflow & Planning

*Productivity fits the self-tracking framing better than "Developer Tools",
which would attract the wrong audience.*

---

## Pre-submission checklist

- [ ] Privacy policy published at a public URL and linked in the listing
- [ ] Screenshots taken from the real UI (see `README.md` in this folder)
- [ ] `icon128-store.png` uploaded
- [ ] Single purpose statement matches the manifest `description`
- [ ] Permission justifications match what the code actually does
- [ ] Data safety answers match the privacy policy
- [ ] Repo public so the source-verification claim in the description holds true
