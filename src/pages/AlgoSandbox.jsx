import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { AllAssets, generateInitialDataset, getAssetInfo } from '../services/assetDataSimulator';
import { compute } from '../services/indicatorEngine';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

const TEMPLATES = {
  sma_crossover: {
    name: 'SMA Crossover (20/50)',
    description: 'Buy when SMA-20 crosses above SMA-50. Sell when it crosses below.',
    code: `// SMA Crossover Strategy
// Available: candles[], indicators{}, capital, symbol
// Return array of signals: { index, action: 'BUY'|'SELL' }

const sma20 = indicators.SMA_20;
const sma50 = indicators.SMA_50;
const signals = [];

for (let i = 1; i < candles.length; i++) {
  const prev20 = sma20[i - 1], curr20 = sma20[i];
  const prev50 = sma50[i - 1], curr50 = sma50[i];
  if (prev20 != null && curr20 != null && prev50 != null && curr50 != null) {
    if (prev20 <= prev50 && curr20 > curr50) signals.push({ index: i, action: 'BUY' });
    if (prev20 >= prev50 && curr20 < curr50) signals.push({ index: i, action: 'SELL' });
  }
}
return signals;`,
  },
  rsi_reversal: {
    name: 'RSI Reversal (14)',
    description: 'Buy when RSI dips below 30 (oversold). Sell when RSI rises above 70 (overbought).',
    code: `// RSI Reversal Strategy
// RSI < 30 = oversold (BUY), RSI > 70 = overbought (SELL)

const rsi = indicators.RSI_14;
const signals = [];

for (let i = 1; i < candles.length; i++) {
  if (rsi[i] != null) {
    if (rsi[i - 1] >= 30 && rsi[i] < 30) signals.push({ index: i, action: 'BUY' });
    if (rsi[i - 1] <= 70 && rsi[i] > 70) signals.push({ index: i, action: 'SELL' });
  }
}
return signals;`,
  },
  ema_breakout: {
    name: 'EMA Breakout (12/26)',
    description: 'Buy when price crosses above EMA-12. Sell when price drops below EMA-26.',
    code: `// EMA Breakout Strategy

const ema12 = indicators.EMA_12;
const ema26 = indicators.EMA_26;
const signals = [];

for (let i = 1; i < candles.length; i++) {
  const price = candles[i].close;
  const prevPrice = candles[i - 1].close;
  if (ema12[i] != null) {
    if (prevPrice <= ema12[i - 1] && price > ema12[i]) signals.push({ index: i, action: 'BUY' });
  }
  if (ema26[i] != null) {
    if (prevPrice >= ema26[i - 1] && price < ema26[i]) signals.push({ index: i, action: 'SELL' });
  }
}
return signals;`,
  },
  custom: {
    name: 'Custom Strategy',
    description: 'Write your own algorithm using candles[], indicators{}, and capital.',
    code: `// Custom Strategy — write your own logic!
// candles[i] = { time, open, high, low, close, volume }
// indicators = { SMA_20[], EMA_12[], EMA_26[], RSI_14[], ... }
// Return: array of { index, action: 'BUY' | 'SELL' }

const signals = [];

// Example: simple momentum — buy if 3 consecutive green candles
for (let i = 2; i < candles.length; i++) {
  const green = candles[i].close > candles[i].open;
  const prevGreen = candles[i-1].close > candles[i-1].open;
  const prev2Green = candles[i-2].close > candles[i-2].open;
  if (green && prevGreen && prev2Green) signals.push({ index: i, action: 'BUY' });
  if (!green && !prevGreen) signals.push({ index: i, action: 'SELL' });
}
return signals;`,
  },
};

const INDICATOR_MAP = {
  SMA_20:  { type: 'SMA',  params: { period: 20 } },
  SMA_50:  { type: 'SMA',  params: { period: 50 } },
  EMA_12:  { type: 'EMA',  params: { period: 12 } },
  EMA_26:  { type: 'EMA',  params: { period: 26 } },
  RSI_14:  { type: 'RSI',  params: { period: 14 } },
  MACD:    { type: 'MACD', params: { fast: 12, slow: 26, signal: 9 } },
};

function runSandbox(code, candles, indicators) {
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function('candles', 'indicators', 'capital', code);
    const result = fn(candles, indicators, 1000000);
    if (!Array.isArray(result)) return { error: 'Your function must return an array of signals.' };
    return { signals: result };
  } catch (e) {
    return { error: e.message };
  }
}

function computeAllIndicators(candles) {
  const result = {};
  Object.entries(INDICATOR_MAP).forEach(([key, { type, params }]) => {
    const out = compute(type, candles, params);
    if (Array.isArray(out)) result[key] = out;
    else if (out && typeof out === 'object') {
      // Flatten MACD etc.
      Object.entries(out).forEach(([k, v]) => { result[`${key}_${k}`] = v; });
    }
  });
  return result;
}

function backtestSignals(signals, candles, initialCapital = 1000000) {
  let cash = initialCapital;
  let shares = 0;
  let avgCost = 0;
  const trades = [];
  const equity = [];
  let peak = initialCapital;
  let maxDD = 0;

  const signalMap = {};
  signals.forEach(s => { signalMap[s.index] = s.action; });

  candles.forEach((c, i) => {
    const sig = signalMap[i];
    if (sig === 'BUY' && cash > c.close) {
      const qty = Math.floor(cash * 0.95 / c.close);
      if (qty > 0) {
        avgCost = c.close;
        shares += qty;
        cash -= qty * c.close;
        trades.push({ index: i, action: 'BUY', price: c.close, qty, pnl: 0, time: c.time });
      }
    } else if (sig === 'SELL' && shares > 0) {
      const pnl = (c.close - avgCost) * shares;
      cash += shares * c.close;
      trades.push({ index: i, action: 'SELL', price: c.close, qty: shares, pnl, time: c.time });
      shares = 0;
    }
    const total = cash + shares * c.close;
    equity.push({ time: new Date(c.time * 1000).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }), value: parseFloat(total.toFixed(2)) });
    if (total > peak) peak = total;
    const dd = ((peak - total) / peak) * 100;
    if (dd > maxDD) maxDD = dd;
  });

  const finalEquity = equity[equity.length - 1]?.value || initialCapital;
  const totalReturn = ((finalEquity - initialCapital) / initialCapital) * 100;
  const sells = trades.filter(t => t.action === 'SELL');
  const wins = sells.filter(t => t.pnl > 0);
  return {
    totalReturn: parseFloat(totalReturn.toFixed(2)),
    winRate: sells.length > 0 ? parseFloat(((wins.length / sells.length) * 100).toFixed(1)) : 0,
    maxDrawdown: parseFloat(maxDD.toFixed(2)),
    totalTrades: trades.length,
    finalEquity,
    equity,
    trades,
  };
}

export default function AlgoSandbox() {
  const [selectedTemplate, setSelectedTemplate] = useState('sma_crossover');
  const [code, setCode] = useState(TEMPLATES.sma_crossover.code);
  const [symbol, setSymbol] = useState('AAPL');
  const [timeframe, setTimeframe] = useState('1Y');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);
  const [chartData, setChartData] = useState([]);
  const textareaRef = useRef(null);

  const loadTemplate = (key) => {
    setSelectedTemplate(key);
    setCode(TEMPLATES[key].code);
    setResult(null);
    setError('');
  };

  const runAlgo = () => {
    setRunning(true);
    setError('');
    setResult(null);
    setTimeout(() => {
      try {
        const candles = generateInitialDataset(symbol, timeframe);
        const indicators = computeAllIndicators(candles);
        const { signals, error: sandboxErr } = runSandbox(code, candles, indicators);
        if (sandboxErr) { setError(sandboxErr); setRunning(false); return; }
        const bt = backtestSignals(signals, candles);
        setResult(bt);
        setChartData(bt.equity.filter((_, i) => i % 3 === 0));
      } catch (e) {
        setError(e.message);
      }
      setRunning(false);
    }, 300);
  };

  const handleTabKey = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const el = textareaRef.current;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const newCode = code.substring(0, start) + '  ' + code.substring(end);
      setCode(newCode);
      requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = start + 2; });
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>🧪 Algo Sandbox</h1>
        <p>Write JavaScript algorithms and backtest them against historical price data instantly.</p>
      </div>

      {/* Template Picker */}
      <div className="card card-body" style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 14 }}>📋 Strategy Templates</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {Object.entries(TEMPLATES).map(([key, t]) => (
            <button
              key={key}
              className={`btn btn-sm ${selectedTemplate === key ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => loadTemplate(key)}
            >
              {t.name}
            </button>
          ))}
        </div>
        {selectedTemplate && (
          <div style={{ marginTop: 10, fontSize: 13, color: 'var(--t-2)', padding: '8px 12px', background: 'var(--bg-surface)', borderRadius: 8 }}>
            💡 {TEMPLATES[selectedTemplate].description}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>
        {/* Code Editor */}
        <div className="card card-body">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>✏️ Algorithm Editor</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <select className="form-input form-select" value={symbol} onChange={e => setSymbol(e.target.value)}
                style={{ padding: '5px 10px', fontSize: 12, width: 100 }}>
                {AllAssets.filter(a => a.assetType === 'stock').map(a => (
                  <option key={a.symbol} value={a.symbol}>{a.symbol}</option>
                ))}
              </select>
              {['1M', '3M', '1Y'].map(tf => (
                <button key={tf} className={`btn btn-xs ${timeframe === tf ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setTimeframe(tf)}>{tf}</button>
              ))}
            </div>
          </div>

          <textarea
            ref={textareaRef}
            value={code}
            onChange={e => setCode(e.target.value)}
            onKeyDown={handleTabKey}
            spellCheck={false}
            style={{
              width: '100%', minHeight: 340, fontFamily: "'Courier New', monospace",
              fontSize: 13, lineHeight: 1.6, padding: '14px 16px',
              background: 'var(--bg-surface)', color: 'var(--t-0)',
              border: '1px solid var(--border)', borderRadius: 10,
              resize: 'vertical', outline: 'none', boxSizing: 'border-box',
            }}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--t-3)' }}>
              Available: <code style={{ color: 'var(--brand)' }}>candles[]</code>, <code style={{ color: 'var(--brand)' }}>indicators{'{'}</code>
              <code style={{ color: 'var(--brand)' }}>SMA_20, SMA_50, EMA_12, EMA_26, RSI_14{'}'}</code>, <code style={{ color: 'var(--brand)' }}>capital</code>
            </div>
            <button className="btn btn-primary" onClick={runAlgo} disabled={running} style={{ minWidth: 140 }}>
              {running ? '⏳ Running...' : '▶ Run Backtest'}
            </button>
          </div>

          {error && (
            <div className="error-msg" style={{ marginTop: 12 }}>
              <strong>❌ Error:</strong> {error}
            </div>
          )}
        </div>

        {/* Results Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {result ? (
            <>
              <div className="card card-body">
                <div style={{ fontWeight: 700, marginBottom: 14, fontSize: 14 }}>📊 Backtest Results</div>
                {[
                  ['Total Return', `${result.totalReturn >= 0 ? '+' : ''}${result.totalReturn}%`, result.totalReturn >= 0],
                  ['Win Rate', `${result.winRate}%`, result.winRate >= 50],
                  ['Max Drawdown', `-${result.maxDrawdown}%`, false],
                  ['Total Trades', result.totalTrades, undefined],
                  ['Final Equity', `₹${result.finalEquity.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, result.finalEquity >= 1000000],
                ].map(([k, v, up]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                    <span style={{ color: 'var(--t-2)' }}>{k}</span>
                    <span className={up === undefined ? '' : up ? 'positive' : 'negative'} style={{ fontWeight: 700 }}>{v}</span>
                  </div>
                ))}
              </div>

              <div className="card card-body">
                <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 14 }}>📈 Equity Curve</div>
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={chartData}>
                    <XAxis dataKey="time" hide />
                    <YAxis hide />
                    <Tooltip contentStyle={{ background: 'var(--bg-modal)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }}
                      formatter={v => `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} />
                    <defs>
                      <linearGradient id="algoGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={result.totalReturn >= 0 ? '#00d084' : '#ff4757'} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={result.totalReturn >= 0 ? '#00d084' : '#ff4757'} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <ReferenceLine y={1000000} stroke="var(--t-3)" strokeDasharray="3 3" />
                    <Area type="monotone" dataKey="value"
                      stroke={result.totalReturn >= 0 ? '#00d084' : '#ff4757'}
                      fill="url(#algoGrad)" strokeWidth={2} dot={false} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="card card-body">
                <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 14 }}>🔁 Recent Trades</div>
                <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                  {result.trades.slice(-10).reverse().map((t, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                      <span className={t.action === 'BUY' ? 'positive' : 'negative'} style={{ fontWeight: 700 }}>{t.action}</span>
                      <span style={{ color: 'var(--t-2)' }}>₹{t.price.toFixed(2)} × {t.qty}</span>
                      {t.action === 'SELL' && <span className={t.pnl >= 0 ? 'positive' : 'negative'}>{t.pnl >= 0 ? '+' : ''}₹{t.pnl.toFixed(0)}</span>}
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="card card-body" style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🧬</div>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>No Results Yet</div>
              <div style={{ fontSize: 13, color: 'var(--t-3)' }}>Select a template or write your algorithm, then click Run Backtest.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
