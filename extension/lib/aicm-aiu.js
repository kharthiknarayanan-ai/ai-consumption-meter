// aiU weighting. Canonical copy — loaded as a plain script inside the
// extension (creating `AICM_AIU`) and require()d by the optional Node backend.
// Keeping one implementation avoids the two drifting apart, which would mean
// the same activity scoring differently depending on where it was counted.
(function (root, factory) {
  const mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else root.AICM_AIU = mod;
})(typeof self !== 'undefined' ? self : this, function () {
  // Rough, directional weighting — not a precise measurement.
  // ~500 characters of AI output is treated as roughly "1 aiU" of cognitive
  // work replaced. Category multipliers reflect that a full delegated draft
  // replaces more thinking than an ambient autocomplete accept did.
  const CATEGORY_MULTIPLIER = {
    direct_query: 1, // asked a question, used the answer as-is
    delegated_creation: 1.2, // had AI produce content you then used/published
    decision: 0.5, // AI filtered/ranked options, you made the final call
    ambient: 0.3, // autocomplete, inline suggestions you accepted
  };

  const CHARS_PER_AIU = 500;
  const MIN_AIU = 0.1;

  function computeAiu(outputLength, category) {
    const length = Number.isFinite(outputLength) ? Math.max(outputLength, 0) : 0;
    const multiplier = CATEGORY_MULTIPLIER[category] ?? CATEGORY_MULTIPLIER.direct_query;
    const raw = (length / CHARS_PER_AIU) * multiplier;
    return Math.max(MIN_AIU, Math.round(raw * 100) / 100);
  }

  return { computeAiu, CATEGORY_MULTIPLIER, CHARS_PER_AIU, MIN_AIU };
});
