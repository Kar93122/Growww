const bodySize = (c) => Math.abs(c.close - c.open);
const isBullish = (c) => c.close > c.open;
const isBearish = (c) => c.close < c.open;
const upperWick = (c) => c.high - Math.max(c.open, c.close);
const lowerWick = (c) => Math.min(c.open, c.close) - c.low;
const totalRange = (c) => c.high - c.low;

const PATTERNS = {
  Doji: {
    signal: 'neutral', minCandles: 1,
    description: 'Opening and closing prices are nearly equal, showing market indecision.',
    implication: 'Potential trend reversal or continuation — watch for confirmation.',
    detect: ([c]) => {
      if (totalRange(c) === 0) return 0;
      return bodySize(c) / totalRange(c) < 0.1 ? 85 : 0;
    },
  },
  Hammer: {
    signal: 'bullish', minCandles: 1,
    description: 'Small body at the top with a long lower shadow — sellers pushed price down but buyers recovered.',
    implication: 'Bullish reversal signal, especially at support levels.',
    detect: ([c]) => {
      const body = bodySize(c);
      const lower = lowerWick(c);
      const upper = upperWick(c);
      if (body === 0) return 0;
      return (lower >= 2 * body && upper <= 0.3 * body) ? 80 + Math.min(20, (lower / body - 2) * 10) : 0;
    },
  },
  'Inverted Hammer': {
    signal: 'bullish', minCandles: 1,
    description: 'Small body at the bottom with a long upper shadow.',
    implication: 'Potential bullish reversal — buyers attempted to push higher.',
    detect: ([c]) => {
      const body = bodySize(c);
      const lower = lowerWick(c);
      const upper = upperWick(c);
      if (body === 0) return 0;
      return (upper >= 2 * body && lower <= 0.3 * body) ? 70 : 0;
    },
  },
  'Shooting Star': {
    signal: 'bearish', minCandles: 1,
    description: 'Small body at bottom, long upper shadow — price surged then fell back.',
    implication: 'Bearish reversal signal at the top of an uptrend.',
    detect: ([c], prev = []) => {
      const body = bodySize(c);
      const upper = upperWick(c);
      const lower = lowerWick(c);
      if (body === 0) return 0;
      const uptrend = prev.length >= 2 && prev[prev.length - 1].close > prev[0].close;
      return (upper >= 2 * body && lower <= 0.3 * body && uptrend) ? 80 : 0;
    },
  },
  'Hanging Man': {
    signal: 'bearish', minCandles: 1,
    description: 'Hammer shape appearing at the top of an uptrend.',
    implication: 'Bearish reversal warning — bulls losing control.',
    detect: ([c], prev = []) => {
      const body = bodySize(c);
      const lower = lowerWick(c);
      const upper = upperWick(c);
      if (body === 0) return 0;
      const uptrend = prev.length >= 2 && prev[prev.length - 1].close > prev[0].close;
      return (lower >= 2 * body && upper <= 0.3 * body && uptrend) ? 75 : 0;
    },
  },
  'Spinning Top': {
    signal: 'neutral', minCandles: 1,
    description: 'Small body with equal upper and lower shadows.',
    implication: 'Market indecision — neither buyers nor sellers in control.',
    detect: ([c]) => {
      const body = bodySize(c);
      const upper = upperWick(c);
      const lower = lowerWick(c);
      const range = totalRange(c);
      if (range === 0) return 0;
      const bodyRatio = body / range;
      const wickBalance = Math.abs(upper - lower) / range;
      return (bodyRatio < 0.3 && wickBalance < 0.3 && body > 0) ? 70 : 0;
    },
  },
  'Bull Marubozu': {
    signal: 'bullish', minCandles: 1,
    description: 'Large bullish candle with no or tiny wicks — complete buyer dominance.',
    implication: 'Strong bullish momentum, continuation likely.',
    detect: ([c]) => {
      const body = bodySize(c);
      const range = totalRange(c);
      if (range === 0) return 0;
      return (isBullish(c) && body / range > 0.92) ? 90 : 0;
    },
  },
  'Bear Marubozu': {
    signal: 'bearish', minCandles: 1,
    description: 'Large bearish candle with no or tiny wicks — complete seller dominance.',
    implication: 'Strong bearish momentum, further decline likely.',
    detect: ([c]) => {
      const body = bodySize(c);
      const range = totalRange(c);
      if (range === 0) return 0;
      return (isBearish(c) && body / range > 0.92) ? 90 : 0;
    },
  },
  'Bullish Engulfing': {
    signal: 'bullish', minCandles: 2,
    description: 'A large bullish candle fully engulfs the previous bearish candle.',
    implication: 'Strong bullish reversal signal — buyers have taken over.',
    detect: ([c1, c2]) => {
      return (isBearish(c1) && isBullish(c2) &&
        c2.open < c1.close && c2.close > c1.open) ? 85 : 0;
    },
  },
  'Bearish Engulfing': {
    signal: 'bearish', minCandles: 2,
    description: 'A large bearish candle fully engulfs the previous bullish candle.',
    implication: 'Strong bearish reversal signal — sellers have taken control.',
    detect: ([c1, c2]) => {
      return (isBullish(c1) && isBearish(c2) &&
        c2.open > c1.close && c2.close < c1.open) ? 85 : 0;
    },
  },
  'Bullish Harami': {
    signal: 'bullish', minCandles: 2,
    description: 'Small bullish candle inside a large bearish candle.',
    implication: 'Potential bullish reversal — bearish momentum weakening.',
    detect: ([c1, c2]) => {
      return (isBearish(c1) && isBullish(c2) &&
        c2.open > c1.close && c2.close < c1.open) ? 72 : 0;
    },
  },
  'Bearish Harami': {
    signal: 'bearish', minCandles: 2,
    description: 'Small bearish candle inside a large bullish candle.',
    implication: 'Potential bearish reversal — bullish momentum fading.',
    detect: ([c1, c2]) => {
      return (isBullish(c1) && isBearish(c2) &&
        c2.open < c1.close && c2.close > c1.open) ? 72 : 0;
    },
  },
  'Tweezer Bottom': {
    signal: 'bullish', minCandles: 2,
    description: 'Two candles with equal lows — strong support level.',
    implication: 'Bullish reversal — price has found a floor.',
    detect: ([c1, c2]) => {
      const diff = Math.abs(c1.low - c2.low) / c1.low;
      return (isBearish(c1) && isBullish(c2) && diff < 0.002) ? 78 : 0;
    },
  },
  'Tweezer Top': {
    signal: 'bearish', minCandles: 2,
    description: 'Two candles with equal highs — strong resistance level.',
    implication: 'Bearish reversal — price has hit a ceiling.',
    detect: ([c1, c2]) => {
      const diff = Math.abs(c1.high - c2.high) / c1.high;
      return (isBullish(c1) && isBearish(c2) && diff < 0.002) ? 78 : 0;
    },
  },
  'Morning Star': {
    signal: 'bullish', minCandles: 3,
    description: 'Large bear + small-body + large bull — three-candle reversal pattern.',
    implication: 'Strong bullish reversal after a downtrend.',
    detect: ([c1, c2, c3]) => {
      return (isBearish(c1) && bodySize(c1) > bodySize(c2) * 2 &&
        isBullish(c3) && bodySize(c3) > bodySize(c2) * 2 &&
        c3.close > (c1.open + c1.close) / 2) ? 88 : 0;
    },
  },
  'Evening Star': {
    signal: 'bearish', minCandles: 3,
    description: 'Large bull + small-body + large bear — three-candle reversal pattern.',
    implication: 'Strong bearish reversal after an uptrend.',
    detect: ([c1, c2, c3]) => {
      return (isBullish(c1) && bodySize(c1) > bodySize(c2) * 2 &&
        isBearish(c3) && bodySize(c3) > bodySize(c2) * 2 &&
        c3.close < (c1.open + c1.close) / 2) ? 88 : 0;
    },
  },
  'Three White Soldiers': {
    signal: 'bullish', minCandles: 3,
    description: 'Three consecutive large bullish candles, each closing higher.',
    implication: 'Strong sustained bullish momentum.',
    detect: ([c1, c2, c3]) => {
      return (isBullish(c1) && isBullish(c2) && isBullish(c3) &&
        c2.close > c1.close && c3.close > c2.close &&
        c2.open > c1.open && c3.open > c2.open) ? 90 : 0;
    },
  },
  'Three Black Crows': {
    signal: 'bearish', minCandles: 3,
    description: 'Three consecutive large bearish candles, each closing lower.',
    implication: 'Strong sustained bearish momentum.',
    detect: ([c1, c2, c3]) => {
      return (isBearish(c1) && isBearish(c2) && isBearish(c3) &&
        c2.close < c1.close && c3.close < c2.close &&
        c2.open < c1.open && c3.open < c2.open) ? 90 : 0;
    },
  },
};

export const PATTERN_NAMES = Object.keys(PATTERNS);
export const getPatternMeta = (name) => PATTERNS[name] || null;

export const detectPatterns = (candles) => {
  const results = [];
  candles.forEach((_, i) => {
    Object.entries(PATTERNS).forEach(([name, p]) => {
      const needed = p.minCandles;
      if (i < needed - 1) return;
      const window = candles.slice(i - needed + 1, i + 1);
      const prev = candles.slice(Math.max(0, i - needed - 4), i - needed + 1);
      const confidence = p.detect(window, prev);
      if (confidence > 0) {
        results.push({
          pattern: name,
          signal: p.signal,
          candleIndex: i,
          time: candles[i].time,
          confidence,
          description: p.description,
          implication: p.implication,
        });
      }
    });
  });
  return results;
};

export const detectRealTime = (newCandle, prevCandles) =>
  detectPatterns([...prevCandles.slice(-2), newCandle]);
