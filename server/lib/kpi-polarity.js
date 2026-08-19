const POLARITY_VALUES = ['maximize', 'minimize', 'faster', 'range'];

function normalizePolarity(polarity) {
  const value = (polarity || 'maximize').toString().trim().toLowerCase();
  if (POLARITY_VALUES.includes(value)) return value;
  return 'maximize';
}

function computePencapaianByPolarity(actual, target, polarity = 'maximize', options = {}) {
  const a = parseFloat(actual);
  const t = parseFloat(target);
  if (Number.isNaN(t) || t <= 0 || Number.isNaN(a)) return 0;

  const mode = normalizePolarity(polarity);
  const lowerRatio = options.lowerRatio ?? 0.9;
  const upperRatio = options.upperRatio ?? 1.1;

  if (mode === 'minimize' || mode === 'faster') {
    if (a <= 0) return 0;
    return (t / a) * 100;
  }

  if (mode === 'range') {
    const bb = t * lowerRatio;
    const ba = t * upperRatio;
    if (a >= bb && a <= ba) return 100;
    if (a < bb) return bb > 0 ? (a / bb) * 100 : 0;
    return a > 0 ? (ba / a) * 100 : 0;
  }

  if (a <= 0) return 0;
  return (a / t) * 100;
}

module.exports = { normalizePolarity, computePencapaianByPolarity, POLARITY_VALUES };
