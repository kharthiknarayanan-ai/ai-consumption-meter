# Privacy Policy — AI Consumption Meter

**Last updated:** 26 July 2026
**Version:** 1.0

## The short version

This extension does not collect your data, because there is nowhere for it to go. There is no server, no account, and no analytics. In its default configuration the extension makes no network requests of any kind.

Everything it measures is stored in your own browser and stays there.

## What the extension measures

On five websites — `chatgpt.com`, `chat.openai.com`, `claude.ai`, `gemini.google.com`, and `www.google.com` — the extension detects when an AI-generated response appears and records:

- **How many characters long** the response was
- **Which site** it came from
- **Which category** it falls into (a direct question, a longer generated draft, a search summary you didn't ask for, or a suggestion you selected)
- **The date** it happened

That's all. These are combined into daily totals.

## What the extension does NOT do

It does not read, store, or transmit the text of your conversations. Only the length is measured — the number of characters, never the characters themselves.

It does not record your browsing history. It does not know or store which pages you visit, which searches you run, or what you asked an AI. It knows only that a response of some length occurred, on one of five sites, on a given day.

It does not track you across the web. It has no access to any site other than the five listed above.

It does not collect personal information of any kind: no name, email, account identifier, IP address, or location.

It contains no analytics, no telemetry, no advertising identifiers, and no third-party code that phones home. The one bundled third-party library (Chart.js, for drawing graphs) is included in the extension package and loads from disk, not from a network.

## Where your data is stored

In `chrome.storage.local` — your browser's own storage, on your own device. It is not synced to a Google account, not backed up to any server, and not accessible to anyone but you.

A randomly generated device identifier is created locally to label your own data. It is not derived from anything about you, is never transmitted, and cannot be used to identify you.

## Your controls

From the extension's dashboard you can, at any time:

- **Download all your data** as a JSON file
- **Restore** from a previously downloaded file
- **Delete everything**, permanently and immediately

Uninstalling the extension also removes all stored data.

## Data retention

Daily totals are kept for 400 days and then automatically deleted. Since nothing is transmitted, no copy exists anywhere else.

## Optional local companion server

The project includes an optional open-source companion server that advanced users can run **on their own computer** to keep a detailed event log.

This is **disabled by default** and does nothing unless you deliberately turn it on and grant an additional permission. When enabled, data is sent only to `http://localhost:4141` — an address on your own machine. It is never sent to any remote server, including any server operated by the developer. The developer operates no servers of any kind.

## Permissions, and why each is needed

**`storage`** — to save your measurements locally. This is the extension's entire function; without it there is nothing to show you.

**Access to the five AI sites listed above** — to detect when an AI response appears and measure its length. The extension needs to see these pages to count what's on them. It requests access to no other sites.

**`localhost:4141` (optional, not granted at install)** — only for the optional companion server described above.

## Children

This extension is not directed at children and collects no data from anyone, including children.

## Changes to this policy

If this policy changes, the version number and date at the top will be updated and the change described in the repository's commit history. Because the extension is open source, any change to what data is handled is publicly visible in the code.

## Verifying these claims

You do not have to take any of this on trust. The complete source code is public:

**https://github.com/kharthiknarayanan-ai/ai-consumption-meter**

The claim that the extension makes no network requests can be checked directly: open Chrome DevTools, go to the Network tab, and use the extension. You can also inspect the code — there is no build step or minification, so the published source is exactly what runs.

## Contact

Questions or concerns: open an issue at
**https://github.com/kharthiknarayanan-ai/ai-consumption-meter/issues**
