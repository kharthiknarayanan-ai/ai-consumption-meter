---
name: Detection stopped working
about: The meter isn't recording on one of the supported sites
title: 'Detection not working: '
labels: detection
---

<!--
This is the most common issue with this extension, and usually means a site
changed its page structure. Please don't paste any conversation content —
it isn't needed to fix this, and we don't want it.
-->

**Which site?**
<!-- ChatGPT / Claude / Gemini / Google AI Overview -->

**Extension version:**
<!-- Shown at chrome://extensions -->

**Browser and OS:**

**What the popup said, if anything:**
<!-- The extension warns when it thinks detection has broken -->

**Console output (optional but very helpful):**
<!--
Open the affected site, press Cmd+Option+I (Mac) or F12 (Windows), go to the
Console tab, and paste any lines starting with [AICM].
-->

---

### Want to help fix it faster?

Selector breakage is usually a two-minute fix if you can identify the new
markup. On the affected page, with an AI reply visible, open the Console and run:

```js
[...new Set([...document.querySelectorAll('[data-testid]')].map(el => el.getAttribute('data-testid')))]
```

If that returns an empty array, try custom element tags instead:

```js
[...new Set([...document.querySelectorAll('*')].map(el => el.tagName.toLowerCase()).filter(t => t.includes('-')))]
```

Paste the output here. That output alone is usually enough to identify the
correct selector.
