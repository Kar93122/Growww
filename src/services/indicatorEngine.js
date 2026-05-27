const sma = (data, period) => data.map((_, i) => {
  if (i < period - 1) return null;
  const slice = data.slice(i - period + 1, i + 1);
  return slice.reduce((s, v) => s + v, 0) / period;
});

const ema = (data, period) => {
  const k = 2 / (period + 1);
  const result = new Array(data.length).fill(null);
  let prevEma = null;
  for (let i = 0; i < data.length; i++) {
    if (data[i] == null) continue;
    if (prevEma === null) {
      if (i >= period - 1) {
        prevEma = data.slice(i - period + 1, i + 1).reduce((s, v) => s + v, 0) / period;
        result[i] = prevEma;
      }
    } else {
      prevEma = data[i] * k + prevEma * (1 - k);
      result[i] = prevEma;
    }
  }
  return result;
};

const computeRSI = (closes, period = 14) => {
  const result = new Array(closes.length).fill(null);
  for (let i = period; i < closes.length; i++) {
    let gains = 0, losses = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const diff = closes[j] - closes[j - 1];
      if (diff > 0) gains += diff; else losses -= diff;
    }
    const rs = losses === 0 ? 100 : gains / losses;
    result[i] = parseFloat((100 - 100 / (1 + rs)).toFixed(2));
  }
  return result;
};

const computeMACD = (closes, fast = 12, slow = 26, signal = 9) => {
  const fastEma = ema(closes, fast);
  const slowEma = ema(closes, slow);
  const macdLine = closes.map((_, i) =>
    fastEma[i] != null && slowEma[i] != null ? fastEma[i] - slowEma[i] : null
  );
  const signalLine = ema(macdLine.filter(v => v != null), signal);
  const fullSignal = new Array(closes.length).fill(null);
  let si = 0;
  macdLine.forEach((v, i) => { if (v != null) { fullSignal[i] = signalLine[si++]; } });
  const histogram = closes.map((_, i) =>
    macdLine[i] != null && fullSignal[i] != null ? macdLine[i] - fullSignal[i] : null
  );
  return { macdLine, signalLine: fullSignal, histogram };
};

const computeBB = (closes, period = 20, stdDev = 2) => {
  const mid = sma(closes, period);
  const upper = [], lower = [];
  closes.forEach((_, i) => {
    if (i < period - 1) { upper.push(null); lower.push(null); return; }
    const slice = closes.slice(i - period + 1, i + 1);
    const mean = mid[i];
    const variance = slice.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / period;
    const sd = Math.sqrt(variance);
    upper.push(parseFloat((mean + stdDev * sd).toFixed(4)));
    lower.push(parseFloat((mean - stdDev * sd).toFixed(4)));
  });
  return { upper, middle: mid, lower };
};

const computeATR = (candles, period = 14) => {
  const tr = candles.map((c, i) => {
    if (i === 0) return c.high - c.low;
    const prev = candles[i - 1];
    return Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close));
  });
  return sma(tr, period);
};

const computeStochastic = (candles, kPeriod = 14, dSmoothing = 3) => {
  const kLine = candles.map((c, i) => {
    if (i < kPeriod - 1) return null;
    const slice = candles.slice(i - kPeriod + 1, i + 1);
    const highest = Math.max(...slice.map(x => x.high));
    const lowest = Math.min(...slice.map(x => x.low));
    return highest === lowest ? 50 : ((c.close - lowest) / (highest - lowest)) * 100;
  });
  const dLine = sma(kLine.filter(v => v != null), dSmoothing);
  const fullD = new Array(candles.length).fill(null);
  let di = 0;
  kLine.forEach((v, i) => { if (v != null) { fullD[i] = dLine[di++]; } });
  return { k: kLine, d: fullD };
};

const computeOBV = (candles) => {
  let obv = 0;
  return candles.map((c, i) => {
    if (i === 0) return 0;
    if (c.close > candles[i - 1].close) obv += c.volume;
    else if (c.close < candles[i - 1].close) obv -= c.volume;
    return obv;
  });
};

const computeVWAP = (candles) => {
  let cumPV = 0, cumV = 0;
  return candles.map(c => {
    const typical = (c.high + c.low + c.close) / 3;
    cumPV += typical * c.volume;
    cumV += c.volume;
    return cumV > 0 ? parseFloat((cumPV / cumV).toFixed(4)) : null;
  });
};

const computeCCI = (candles, period = 20) => {
  return candles.map((_, i) => {
    if (i < period - 1) return null;
    const slice = candles.slice(i - period + 1, i + 1);
    const tp = slice.map(c => (c.high + c.low + c.close) / 3);
    const mean = tp.reduce((s, v) => s + v, 0) / period;
    const mad = tp.reduce((s, v) => s + Math.abs(v - mean), 0) / period;
    return mad === 0 ? 0 : parseFloat(((tp[tp.length - 1] - mean) / (0.015 * mad)).toFixed(2));
  });
};

export const compute = (indicator, candles, params = {}) => {
  const closes = candles.map(c => c.close);
  switch (indicator) {
    case 'SMA': return sma(closes, params.period || 20);
    case 'EMA': return ema(closes, params.period || 20);
    case 'BB': return computeBB(closes, params.period || 20, params.stdDev || 2);
    case 'RSI': return computeRSI(closes, params.period || 14);
    case 'MACD': return computeMACD(closes, params.fast || 12, params.slow || 26, params.signal || 9);
    case 'ATR': return computeATR(candles, params.period || 14);
    case 'VWAP': return computeVWAP(candles);
    case 'Stochastic': return computeStochastic(candles, params.kPeriod || 14, params.dSmoothing || 3);
    case 'OBV': return computeOBV(candles);
    case 'CCI': return computeCCI(candles, params.period || 20);
    default: return [];
  }
};

export const computeAll = (indicatorList, candles) => {
  const results = {};
  indicatorList.forEach(ind => {
    results[ind.id] = compute(ind.type, candles, ind.params);
  });
  return results;
};
