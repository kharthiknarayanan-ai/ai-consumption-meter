// Derived metrics — canonical copy. Loaded as a plain script inside the
// extension (creating `AICM_INSIGHTS`) and require()d by the optional Node
// backend, so both compute personas identically.
(function (root, factory) {
  const mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else root.AICM_INSIGHTS = mod;
})(typeof self !== 'undefined' ? self : this, function () {
  // Derived metrics: human-equivalent effort, efficiency, and a sophistication
  // score / persona.
  //
  // READ THIS BEFORE TRUSTING ANY NUMBER IN HERE.
  //
  // Every figure below rests on assumptions that are reasonable but not
  // measured. This file converts a proxy (characters of AI output) into
  // another proxy (human hours) and then into a third (a persona label). Each
  // step adds error. These are conversation-starters and self-reflection aids,
  // not evidence about a person.
  //
  // In particular: none of this measures the QUALITY of the output, whether the
  // person actually used it, whether it was correct, or whether they could have
  // done the work themselves. See the README for the fuller caveat.

  // --- Human-equivalent effort ------------------------------------------------
  //
  // ASSUMPTION: producing considered, researched prose from scratch — thinking,
  // looking things up, drafting, revising — runs about 3,000 characters per
  // hour of focused work. That's roughly 500 words/hour, which is a commonly
  // cited figure for non-trivial writing (as opposed to raw typing speed, which
  // is many times faster). Highly technical or heavily researched work is
  // slower; casual writing is faster.
  const HUMAN_CHARS_PER_HOUR = 3000;
  const WORK_HOURS_PER_DAY = 8;

  // ASSUMPTION: reading and evaluating AI output runs about 15,000 characters
  // per hour (~250 wpm, average adult reading speed for comprehension). This is
  // the "cost" side of the efficiency calculation — consuming isn't free.
  const READ_CHARS_PER_HOUR = 15000;

  function humanEquivalent(totalChars) {
    const hours = totalChars / HUMAN_CHARS_PER_HOUR;
    return {
      hours: Math.round(hours * 100) / 100,
      manDays: Math.round((hours / WORK_HOURS_PER_DAY) * 100) / 100,
    };
  }

  // Efficiency = how long it would have taken to produce this yourself, divided
  // by how long it takes to read/evaluate it. With the constants above this is
  // a fixed ratio (5x) for any volume — which is exactly why it's reported as a
  // modelled constant and not presented as a personal achievement. It says
  // "reading is ~5x faster than writing," which is a fact about reading, not
  // about the user.
  function efficiency(totalChars) {
    const produceHours = totalChars / HUMAN_CHARS_PER_HOUR;
    const consumeHours = totalChars / READ_CHARS_PER_HOUR;
    const savedHours = produceHours - consumeHours;
    return {
      multiplier: Math.round((HUMAN_CHARS_PER_HOUR > 0 ? READ_CHARS_PER_HOUR / HUMAN_CHARS_PER_HOUR : 0) * 10) / 10,
      savedHours: Math.round(savedHours * 100) / 100,
      savedManDays: Math.round((savedHours / WORK_HOURS_PER_DAY) * 100) / 100,
    };
  }

  // --- Sophistication score ---------------------------------------------------
  //
  // Deliberately NOT volume-based. Someone who sends 200 messages a day is not
  // automatically more skilled than someone who sends five well-aimed ones —
  // and the original premise of this project treats heavy passive consumption
  // as a warning sign, not an achievement. So the score rewards:
  //
  //   breadth      — using more than one tool suggests picking tools per task
  //                  rather than defaulting to whatever's open.
  //   deliberateness — the share of consumption that was actively requested
  //                  (direct_query, delegated_creation) vs. passively received
  //                  (ambient, decision). High ambient share pulls this DOWN.
  //   consistency  — using AI on many distinct days suggests it's integrated
  //                  into a workflow, rather than one big burst.
  //
  // Each component is 0–100; the total is their weighted average.
  const DELIBERATE_CATEGORIES = ['direct_query', 'delegated_creation'];
  const PASSIVE_CATEGORIES = ['ambient', 'decision'];

  const WEIGHTS = { breadth: 0.25, deliberateness: 0.45, consistency: 0.3 };

  function breadthScore(byPlatform) {
    // 1 platform = 40, 2 = 65, 3 = 85, 4+ = 100. Using one tool isn't a failure,
    // so the floor is deliberately not near zero.
    const n = Object.keys(byPlatform).length;
    if (n <= 0) return 0;
    return [0, 40, 65, 85, 100][Math.min(n, 4)];
  }

  function deliberatenessScore(byCategory) {
    const deliberate = DELIBERATE_CATEGORIES.reduce((s, c) => s + (byCategory[c] || 0), 0);
    const passive = PASSIVE_CATEGORIES.reduce((s, c) => s + (byCategory[c] || 0), 0);
    const total = deliberate + passive;
    if (total <= 0) return 0;
    return Math.round((deliberate / total) * 100);
  }

  function consistencyScore(activeDays, windowDays) {
    if (windowDays <= 0) return 0;
    // Full marks at using it ~half the days in the window; beyond that adds
    // nothing, since daily use isn't inherently better than every-other-day use.
    const ratio = activeDays / (windowDays * 0.5);
    return Math.round(Math.max(0, Math.min(1, ratio)) * 100);
  }

  // Persona tiers. Names describe HOW someone uses AI, not how much.
  const PERSONAS = [
    {
      min: 0,
      key: 'passive_recipient',
      name: 'Passive Recipient',
      blurb:
        'Most AI you consume arrives unrequested — search summaries, suggestions. Little deliberate, directed use yet.',
    },
    {
      min: 35,
      key: 'casual_user',
      name: 'Casual User',
      blurb: 'Some deliberate use, mostly on a single tool. AI is an occasional helper rather than part of the workflow.',
    },
    {
      min: 55,
      key: 'practitioner',
      name: 'Practitioner',
      blurb: 'Consistent, deliberate use across tools. AI is genuinely integrated into how you work.',
    },
    {
      min: 75,
      key: 'power_user',
      name: 'Power User',
      blurb:
        'Deliberate, sustained, multi-tool use. You reach for the right tool per task rather than defaulting to one.',
    },
    {
      min: 88,
      key: 'orchestrator',
      name: 'Orchestrator',
      blurb:
        'Broad, highly intentional use sustained over time — very little passive consumption relative to directed work.',
    },
  ];

  function personaFor(score) {
    let match = PERSONAS[0];
    for (const p of PERSONAS) if (score >= p.min) match = p;
    return match;
  }

  // A profile built from two days of data is not a profile. Without this gate,
  // consistency is trivially 100% for a brand-new user (they've used it on every
  // day they've had data), so anyone would rank "Orchestrator" on day two —
  // which would make the whole score meaningless for any external reader.
  //
  // Below the thresholds the score is still computed and shown, but flagged
  // provisional and capped at 'practitioner', so the top tiers have to be earned
  // over real time rather than granted by default.
  const MATURITY = { minActiveDays: 5, minEvents: 25 };
  const PROVISIONAL_CAP = 74; // top of 'practitioner'; blocks power_user/orchestrator

  function sophistication(byPlatform, byCategory, activeDays, windowDays, eventCount = 0) {
    const components = {
      breadth: breadthScore(byPlatform),
      deliberateness: deliberatenessScore(byCategory),
      consistency: consistencyScore(activeDays, windowDays),
    };
    const rawScore = Math.round(
      components.breadth * WEIGHTS.breadth +
        components.deliberateness * WEIGHTS.deliberateness +
        components.consistency * WEIGHTS.consistency
    );

    const provisional = activeDays < MATURITY.minActiveDays || eventCount < MATURITY.minEvents;
    const score = provisional ? Math.min(rawScore, PROVISIONAL_CAP) : rawScore;

    return {
      score,
      rawScore,
      provisional,
      maturity: {
        activeDays,
        eventCount,
        needsActiveDays: Math.max(0, MATURITY.minActiveDays - activeDays),
        needsEvents: Math.max(0, MATURITY.minEvents - eventCount),
      },
      components,
      weights: WEIGHTS,
      persona: personaFor(score),
    };
  }

  // Takes precomputed totals rather than raw events, so the same implementation
  // serves the extension (which stores daily rollups) and the optional Node
  // backend (which stores individual events). Callers compute totalChars,
  // activeDays, and eventCount from whatever shape they hold.
  function buildInsights({ totalChars, activeDays, eventCount, byPlatform, byCategory, windowDays }) {
    return {
      totalChars,
      humanEquivalent: humanEquivalent(totalChars),
      efficiency: efficiency(totalChars),
      activeDays,
      windowDays,
      sophistication: sophistication(byPlatform, byCategory, activeDays, windowDays, eventCount),
      assumptions: {
        humanCharsPerHour: HUMAN_CHARS_PER_HOUR,
        readCharsPerHour: READ_CHARS_PER_HOUR,
        workHoursPerDay: WORK_HOURS_PER_DAY,
      },
    };
  }


  return {
    buildInsights,
    humanEquivalent,
    efficiency,
    sophistication,
    breadthScore,
    deliberatenessScore,
    consistencyScore,
    personaFor,
    PERSONAS,
    MATURITY,
    PROVISIONAL_CAP,
  };
});
