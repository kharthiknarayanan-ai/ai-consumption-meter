# AI Intelligence Consumption Meter (AICM)

## The Core Idea

An electricity meter doesn't care what appliance is drawing power — a fridge, a laptop, a heater — it just measures kWh flowing from the grid into a household. The AI Intelligence Consumption Meter (AICM) applies the same logic to a person's mind: it measures how much "synthetic intelligence" (reasoning, decisions, content, or answers produced by AI) flows into a person's daily life, regardless of which AI "appliance" produced it.

The electricity meter doesn't judge whether you used the power to light a room or run a heater — it just counts units. Likewise, AICM doesn't judge whether the AI wrote your email, picked your route, or answered your question — it counts how much cognitive work was outsourced to a machine instead of done by the person.

## Why an Electricity Meter Is the Right Analogy

An electricity meter works because electricity is invisible, continuous, and easy to lose track of — you don't feel each kWh, you just get a bill at the end of the month that surprises you. AI consumption has the exact same shape: it's invisible (a suggestion here, an autocomplete there, a chatbot answer, a recommended video), continuous (it happens dozens of times a day across many apps), and easy to lose track of (nobody currently has a "monthly AI bill" showing how much thinking they handed off).

The meter doesn't stop you from using electricity — it just makes an invisible flow visible, so you can make informed choices. AICM should work the same way: not a blocker, a mirror.

## What Counts as "Consumption"

Anything where a person receives a completed cognitive output from an AI system rather than producing it themselves. In practice, that spans four categories.

**Direct queries** — asking a chatbot a question and using the answer as-is (search, Q&A, chat assistants). **Delegated creation** — having AI produce content you then use or publish: an essay, code, an image, a summary. **Ambient assistance** — AI you didn't explicitly invoke but that shaped your decision anyway: autocomplete, spell/grammar correction, recommendation feeds (what to watch, buy, read), route suggestions, ranked search results. **Decision assistance** — AI that filtered or ranked options before a human made the final call, such as a résumé screener, a matching algorithm, or a "smart reply" suggestion you clicked instead of typing your own.

The interesting design question is whether ambient/decision assistance should count at full weight or a discounted weight, since the human still exercised some judgment there. A first version of AICM would probably weight these lower than direct queries and delegated creation.

## The Unit of Measurement

Electricity has kWh, a physical, unambiguous unit. Intelligence consumption has no equivalent physical unit, so AICM needs a defensible proxy. A reasonable composite:

One **"AI-unit" (aiU)** = one completed request-response cycle where the AI's output was used, weighted by the estimated cognitive effort it replaced. A one-line autocomplete accept might be 0.1 aiU. A full essay draft might be 5 aiU. A multi-turn research session might be 15–20 aiU. The weighting could start crude (e.g., token count of the AI's output, or time-to-complete estimate for a human doing the same task) and get refined later with user feedback ("was this a big or small assist?").

This mirrors how a "unit" of electricity is really just a proxy for the work that power did (running a bulb for an hour) — not a fundamental physical quantity anyone perceives directly.

## How It Would Actually Be Metered

Electricity meters sit at a single choke point (the point where the grid enters the house), so they catch everything without needing to look inside each appliance. AI consumption has no single choke point — it happens inside a browser tab, inside a phone keyboard, inside a coding editor, inside a search engine's ranking algorithm you never see. So AICM has to meter at several points instead of one:

A browser extension would catch chatbot sessions, AI search overviews, and AI writing tools running in the browser. An OS-level or keyboard-level hook would catch autocomplete and predictive text acceptance. Direct API integration (OAuth-style, opt-in) would catch usage of specific apps like ChatGPT, Claude, or Copilot with precise token/turn counts instead of estimates. A self-reported log would catch everything else — the ambient stuff (recommendation feeds, algorithmic decisions) that's nearly impossible to detect automatically and would otherwise be undercounted.

Realistically, a first build could only reliably meter the browser extension and API-integration layers — that's the equivalent of a "partial meter" that only reads the appliances that are willing to report in, similar to how smart plugs today only meter individual devices rather than a whole house.

## The Dashboard (the "meter display")

An electricity meter's value isn't the number itself — it's the trend and the breakdown, which is why the smart-meter apps show daily/monthly graphs and appliance-level breakdowns. AICM's dashboard should mirror that: a running daily/weekly/monthly "consumption" total in aiU, a breakdown by category (writing vs. coding vs. decisions vs. ambient), a breakdown by which AI "appliance" produced it (ChatGPT, Claude, autocomplete, recommendation feeds), and a trend line so the person can see whether their reliance is rising or falling over time — the AI equivalent of noticing your electricity bill creeping up.

A genuinely useful addition electricity meters don't have: a rough "cognitive independence" ratio — output you produced yourself vs. output AI produced for you in a given period — since the actual goal here isn't just tracking usage, it's self-awareness about dependency.

## Why Someone Would Want This

Three real use cases, in descending order of how well-defined they are today. Personal awareness — the same reason people track screen time or steps: not to shame themselves, but to notice a pattern (e.g., "I let AI write 80% of my emails last month") and decide if that's what they want. Organizational auditing — a company might want to know how much of its output (code, reports, decisions) was AI-generated vs. human-authored, for skill-retention, compliance, or IP reasons. Research — this kind of longitudinal data doesn't really exist yet, and researchers studying cognitive offloading, skill atrophy, or AI dependency would want exactly this kind of instrument.

## Open Problems Worth Being Honest About

A few things that make this harder than an electricity meter, on purpose stated plainly rather than glossed over. There's no universal "outlet" — AI is embedded inside dozens of apps with no shared reporting standard, so full coverage requires cooperation from many platforms that have no obligation to give you that data. Weighting is subjective — deciding that an essay is "5 aiU" and an autocomplete is "0.1 aiU" is a judgment call, not a physical measurement, so the numbers are directional, not precise. Privacy is the whole ballgame — a tool that logs every AI interaction a person has is, by construction, a sensitive surveillance instrument, so it needs to be personal, local-first, and opt-in rather than something an employer or third party can pull without consent. And unlike electricity, there's no bill at the end that forces attention — the incentive to actually look at the dashboard has to be designed in, or it becomes another ignored app icon.

## A Reasonable First Version

Not the full multi-point metering system — start with a browser extension plus manual API-key integrations (ChatGPT, Claude) that logs every session, assigns a rough aiU weight based on output length, and shows a simple daily/weekly dashboard with a category breakdown and a "self-authored vs. AI-assisted" ratio. That alone would prove the concept, be buildable in a reasonably short time, and give real data on whether the idea resonates with anyone before tackling the harder ambient-assistance metering.
