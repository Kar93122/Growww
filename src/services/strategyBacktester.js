import { compute } from './indicatorEngine';
import { executeBuy, executeSell, calculateFees } from './tradeEngine';

const getIndicatorValue = (indicatorResults, ref, index) => {
  if (typeof ref === 'number') return ref;
  if (!ref || !ref.id) return null;
  const series = indicatorResults[ref.id];
  if (!series) return null;
  if (typeof series === 'object' && !Array.isArray(series)) {
    // multi-output like BB, MACD
    const key = ref.key || Object.keys(series)[0];
    return series[key]?.[index] ?? null;
  }
  return series[index] ?? null;
};

const evaluateCondition = (cond, indicatorResults, candle, index) => {
  const leftVal = cond.subject === 'Close' ? candle.close
    : cond.subject === 'Open' ? candle.open
    : cond.subject === 'High' ? candle.high
    : cond.subject === 'Low' ? candle.low
    : getIndicatorValue(indicatorResults, cond.subjectRef, index);
  const rightVal = typeof cond.reference === 'number' ? cond.reference
    : getIndicatorValue(indicatorResults, cond.referenceRef, index);
  if (leftVal == null || rightVal == null) return false;
  const prevLeft = index > 0 ? (cond.subject === 'Close' ? null : getIndicatorValue(indicatorResults, cond.subjectRef, index - 1)) : null;
  switch (cond.operator) {
    case 'crosses above': return prevLeft != null && prevLeft <= rightVal && leftVal > rightVal;
    case 'crosses below': return prevLeft != null && prevLeft >= rightVal && leftVal < rightVal;
    case 'is greater than': return leftVal > rightVal;
    case 'is less than': return leftVal < rightVal;
    case 'equals': return Math.abs(leftVal - rightVal) < 0.001;
    default: return false;
  }
};

const evaluateRule = (rule, indicatorResults, candle, index) => {
  if (!rule.conditions || rule.conditions.length === 0) return false;
  const logic = rule.logic || 'AND';
  if (logic === 'AND') return rule.conditions.every(c => evaluateCondition(c, indicatorResults, candle, index));
  return rule.conditions.some(c => evaluateCondition(c, indicatorResults, candle, index));
};

export const runBacktest = (candles, rules, indicators, initialCapital = 1000000, positionMode = 'fixed', positionSize = 100000) => {
  // Compute all indicators
  const indicatorResults = {};
  indicators.forEach(ind => {
    indicatorResults[ind.id] = compute(ind.type, candles, ind.params);
  });

  let cash = initialCapital;
  let holdings = [];
  const trades = [];
  const equityCurve = [];
  let peakEquity = initialCapital;
  let maxDrawdown = 0;

  candles.forEach((candle, i) => {
    // Evaluate rules
    const buyRules = rules.filter(r => r.action === 'BUY');
    const sellRules = rules.filter(r => r.action === 'SELL');
    const shouldBuy = buyRules.some(r => evaluateRule(r, indicatorResults, candle, i));
    const shouldSell = sellRules.some(r => evaluateRule(r, indicatorResults, candle, i));
    const symbol = rules[0]?.symbol || 'ASSET';

    if (shouldBuy && !shouldSell) {
      const budget = positionMode === 'all' ? cash : Math.min(positionSize, cash * 0.95);
      const qty = Math.floor(budget / candle.close);
      if (qty > 0) {
        const result = executeBuy({ symbol, qty, price: candle.close, cashBalance: cash, holdings });
        if (!result.error) {
          cash = result.newCashBalance;
          const idx = holdings.findIndex(h => h.symbol === symbol);
          if (idx >= 0) holdings[idx] = result.newHolding; else holdings.push(result.newHolding);
          trades.push({ ...result.trade, time: candle.time, index: i });
        }
      }
    } else if (shouldSell) {
      const holding = holdings.find(h => h.symbol === symbol);
      if (holding && holding.qty > 0) {
        const result = executeSell({ symbol, qty: holding.qty, price: candle.close, cashBalance: cash, holdings });
        if (!result.error) {
          cash = result.newCashBalance;
          holdings = holdings.filter(h => h.symbol !== symbol);
          if (result.updatedHolding) holdings.push(result.updatedHolding);
          trades.push({ ...result.trade, time: candle.time, index: i });
        }
      }
    }

    const holdingValue = holdings.reduce((sum, h) => sum + h.qty * candle.close, 0);
    const totalEquity = cash + holdingValue;
    equityCurve.push({ time: candle.time, value: parseFloat(totalEquity.toFixed(2)) });
    if (totalEquity > peakEquity) peakEquity = totalEquity;
    const dd = ((peakEquity - totalEquity) / peakEquity) * 100;
    if (dd > maxDrawdown) maxDrawdown = dd;
  });

  const finalEquity = equityCurve[equityCurve.length - 1]?.value || initialCapital;
  const totalReturn = ((finalEquity - initialCapital) / initialCapital) * 100;
  const winningTrades = trades.filter(t => t.action === 'SELL' && t.realizedPnL > 0);
  const sellTrades = trades.filter(t => t.action === 'SELL');
  const winRate = sellTrades.length > 0 ? (winningTrades.length / sellTrades.length) * 100 : 0;
  const grossProfit = winningTrades.reduce((s, t) => s + t.realizedPnL, 0);
  const grossLoss = Math.abs(sellTrades.filter(t => t.realizedPnL < 0).reduce((s, t) => s + t.realizedPnL, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;
  // Buy-and-hold benchmark
  const firstPrice = candles[0]?.close || 1;
  const lastPrice = candles[candles.length - 1]?.close || 1;
  const vsHoldReturn = ((lastPrice - firstPrice) / firstPrice) * 100;

  return {
    totalReturn: parseFloat(totalReturn.toFixed(2)),
    winRate: parseFloat(winRate.toFixed(2)),
    maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
    totalTrades: trades.length,
    profitFactor: parseFloat(profitFactor.toFixed(2)),
    sharpeRatio: parseFloat((totalReturn / Math.max(maxDrawdown, 1) * 0.5).toFixed(2)),
    equityCurve,
    trades,
    vsHoldReturn: parseFloat(vsHoldReturn.toFixed(2)),
  };
};
