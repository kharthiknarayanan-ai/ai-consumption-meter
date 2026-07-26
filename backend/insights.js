// The implementation now lives in extension/lib/aicm-insights.js so the
// extension and this optional backend can't drift apart — two copies of the
// persona maths would mean the same activity scoring differently depending on
// where it was counted.
//
// This shim exists so existing requires keep working.
module.exports = require('../extension/lib/aicm-insights.js');
