import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { AllAssets, generateInitialDataset, getAssetInfo } from '../services/assetDataSimulator';
import { compute } from '../services/indicatorEngine';
import { runBacktest } from '../services/strategyBacktester';
import { saveStrategy } from '../firebase/firestoreService';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Legend, AreaChart, Area } from 'recharts';

const INDICATOR_TYPES = [
  { type:'SMA', label:'Simple Moving Average', params:[{name:'period',default:20}], pane:'main' },
  { type:'EMA', label:'Exponential Moving Average', params:[{name:'period',default:20}], pane:'main' },
  { type:'BB', label:'Bollinger Bands', params:[{name:'period',default:20},{name:'stdDev',default:2}], pane:'main' },
  { type:'RSI', label:'RSI', params:[{name:'period',default:14}], pane:'sub' },
  { type:'MACD', label:'MACD', params:[{name:'fast',default:12},{name:'slow',default:26},{name:'signal',default:9}], pane:'sub' },
  { type:'ATR', label:'ATR', params:[{name:'period',default:14}], pane:'sub' },
  { type:'Stochastic', label:'Stochastic', params:[{name:'kPeriod',default:14},{name:'dSmoothing',default:3}], pane:'sub' },
  { type:'OBV', label:'On-Balance Volume', params:[], pane:'sub' },
  { type:'VWAP', label:'VWAP', params:[], pane:'main' },
  { type:'CCI', label:'CCI', params:[{name:'period',default:20}], pane:'sub' },
];

const OPERATORS = ['crosses above','crosses below','is greater than','is less than'];

const PRESET_STRATEGIES = [
  {
    name:'RSI Reversal', description:'Buy oversold, sell overbought',
    indicators:[{id:'rsi1',type:'RSI',params:{period:14},color:'#ff9f43'}],
    rules:[
      {action:'BUY',logic:'AND',conditions:[{subject:'RSI(14)',subjectRef:{id:'rsi1'},operator:'is less than',reference:30}]},
      {action:'SELL',logic:'AND',conditions:[{subject:'RSI(14)',subjectRef:{id:'rsi1'},operator:'is greater than',reference:70}]},
    ],
  },
  {
    name:'Golden Cross', description:'SMA 50 crosses above SMA 200',
    indicators:[
      {id:'sma50',type:'SMA',params:{period:50},color:'#6c63ff'},
      {id:'sma200',type:'SMA',params:{period:200},color:'#ffd32a'},
    ],
    rules:[
      {action:'BUY',logic:'AND',conditions:[{subject:'SMA(50)',subjectRef:{id:'sma50'},operator:'crosses above',referenceRef:{id:'sma200',key:undefined}}]},
      {action:'SELL',logic:'AND',conditions:[{subject:'SMA(50)',subjectRef:{id:'sma50'},operator:'crosses below',referenceRef:{id:'sma200'}}]},
    ],
  },
  {
    name:'MACD Crossover', description:'Buy MACD crosses signal, sell vice versa',
    indicators:[{id:'macd1',type:'MACD',params:{fast:12,slow:26,signal:9},color:'#a29bfe'}],
    rules:[
      {action:'BUY',logic:'AND',conditions:[{subject:'MACD',subjectRef:{id:'macd1',key:'macdLine'},operator:'crosses above',referenceRef:{id:'macd1',key:'signalLine'}}]},
      {action:'SELL',logic:'AND',conditions:[{subject:'MACD',subjectRef:{id:'macd1',key:'macdLine'},operator:'crosses below',referenceRef:{id:'macd1',key:'signalLine'}}]},
    ],
  },
];

const COLORS = ['#6c63ff','#00d4aa','#ffd32a','#ff4757','#ff9f43','#a29bfe'];

export default function StrategyBuilder() {
  const { currentUser } = useAuth();
  const [symbol, setSymbol] = useState('AAPL');
  const [tfm, setTfm] = useState('1M');
  const [candles, setCandles] = useState([]);
  const [indicators, setIndicators] = useState([]);
  const [rules, setRules] = useState([]);
  const [stratName, setStratName] = useState('My Strategy');
  const [stratDesc, setStratDesc] = useState('');
  const [backtestResult, setBacktestResult] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [showAddInd, setShowAddInd] = useState(false);
  const [newIndType, setNewIndType] = useState('SMA');
  const [newIndParams, setNewIndParams] = useState({period:20});
  const [saveMsg, setSaveMsg] = useState('');

  useEffect(() => {
    setCandles(generateInitialDataset(symbol, tfm));
  }, [symbol, tfm]);

  const addIndicator = () => {
    const meta = INDICATOR_TYPES.find(i=>i.type===newIndType);
    const id = `${newIndType.toLowerCase()}_${Date.now()}`;
    const color = COLORS[indicators.length % COLORS.length];
    setIndicators(prev => [...prev, { id, type:newIndType, params:{...newIndParams}, color, label:`${meta.label}(${Object.values(newIndParams).join(',')})`, pane:meta.pane }]);
    setShowAddInd(false);
    setNewIndParams({period:20});
  };

  const removeIndicator = (id) => setIndicators(prev => prev.filter(i=>i.id!==id));

  const addRule = (action) => {
    setRules(prev => [...prev, {
      action, logic:'AND',
      conditions:[{ subject:'Close', operator:'crosses above', reference:0, subjectRef:null, referenceRef:null }]
    }]);
  };

  const updateRule = (idx, field, value) => {
    setRules(prev => prev.map((r,i)=>i===idx?{...r,[field]:value}:r));
  };

  const updateCondition = (rIdx, cIdx, field, value) => {
    setRules(prev => prev.map((r,i)=>i===rIdx?{
      ...r, conditions: r.conditions.map((c,j)=>j===cIdx?{...c,[field]:value}:c)
    }:r));
  };

  const removeRule = (idx) => setRules(prev => prev.filter((_,i)=>i!==idx));

  const runBT = () => {
    if (candles.length === 0) return;
    setIsRunning(true);
    // Map rules with symbol
    const mappedRules = rules.map(r=>({...r, symbol}));
    setTimeout(() => {
      const result = runBacktest(candles, mappedRules, indicators, 1000000);
      setBacktestResult(result);
      setIsRunning(false);
    }, 300);
  };

  const loadPreset = (preset) => {
    setStratName(preset.name);
    setStratDesc(preset.description);
    setIndicators(preset.indicators);
    setRules(preset.rules);
    setBacktestResult(null);
  };

  const handleSave = () => {
    saveStrategy(currentUser.uid, {
      name:stratName, description:stratDesc, indicators, rules,
      backtestResults: backtestResult ? {
        totalReturn:backtestResult.totalReturn,
        winRate:backtestResult.winRate,
        maxDrawdown:backtestResult.maxDrawdown,
        trades:backtestResult.totalTrades,
      } : null,
    }).catch(console.error);
    setSaveMsg('✓ Saved to Strategy Library!');
    setTimeout(()=>setSaveMsg(''),3000);
  };

  // Build chart data with indicators
  const chartData = candles.slice(-120).map((c,i) => {
    const pt = { time: new Date(c.time*1000).toLocaleDateString('en-IN',{month:'short',day:'numeric'}), price:c.close };
    indicators.forEach(ind => {
      const result = compute(ind.type, candles, ind.params);
      const offset = candles.length - 120;
      const realIdx = offset + i;
      if (Array.isArray(result)) { pt[ind.id] = result[realIdx]; }
      else if (result && typeof result === 'object') {
        Object.keys(result).forEach(k=>{ pt[`${ind.id}_${k}`] = result[k]?.[realIdx]; });
      }
    });
    return pt;
  });

  // Signal markers on chart data
  if (backtestResult) {
    backtestResult.trades.forEach(t => {
      const idx = t.index - (candles.length - 120);
      if (idx >= 0 && idx < chartData.length) {
        chartData[idx].signal = t.action === 'BUY' ? 'buy' : 'sell';
      }
    });
  }

  const subIndicators = indicators.filter(i=>i.pane==='sub');
  const mainIndicators = indicators.filter(i=>i.pane==='main');

  const getSubjectOptions = () => {
    const base = ['Close','Open','High','Low'];
    indicators.forEach(ind => {
      base.push(`${ind.type}(${Object.values(ind.params).join(',')})`);
    });
    return base;
  };

  const getReferenceRef = (subject) => {
    if (!subject) return null;
    const ind = indicators.find(i => subject.startsWith(i.type));
    return ind ? { id: ind.id } : null;
  };

  return (
    <div className="page-container">
      <div className="page-header" style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
        <div>
          <h1>⚙️ Strategy Builder</h1>
          <p>Build, backtest, and deploy custom trading strategies</p>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          {saveMsg && <span style={{fontSize:13,color:'var(--green)'}}>{saveMsg}</span>}
          <button className="btn btn-secondary btn-sm" onClick={handleSave}>💾 Save Strategy</button>
        </div>
      </div>

      {/* Preset Strategies */}
      <div className="card card-body" style={{marginBottom:20}}>
        <div style={{fontWeight:700,marginBottom:10}}>Preset Strategies — clone a starting point</div>
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
          {PRESET_STRATEGIES.map(p=>(
            <button key={p.name} className="btn btn-secondary btn-sm" onClick={()=>loadPreset(p)}
              title={p.description}>
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'260px 1fr 320px',gap:20,alignItems:'start'}}>
        {/* Column 1: Indicators */}
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div className="card card-body">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
              <span style={{fontWeight:700,fontSize:14}}>Indicators</span>
              <button className="btn btn-primary btn-xs" onClick={()=>setShowAddInd(true)}>+ Add</button>
            </div>

            {indicators.length === 0 && (
              <div style={{fontSize:12,color:'var(--text-muted)',textAlign:'center',padding:'12px 0'}}>No indicators added</div>
            )}

            {indicators.map(ind=>(
              <div key={ind.id} style={{background:'var(--bg-surface)',borderRadius:'var(--radius)',padding:10,marginBottom:8,borderLeft:`3px solid ${ind.color}`}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div>
                    <div style={{fontWeight:700,fontSize:13}}>{ind.type}</div>
                    <div style={{fontSize:11,color:'var(--text-muted)'}}>{Object.entries(ind.params).map(([k,v])=>`${k}:${v}`).join(', ')}</div>
                  </div>
                  <button onClick={()=>removeIndicator(ind.id)} style={{color:'var(--red)',background:'none',fontSize:14,cursor:'pointer'}}>✕</button>
                </div>
              </div>
            ))}

            {/* Symbol + Timeframe */}
            <div style={{marginTop:12,paddingTop:12,borderTop:'1px solid var(--border)'}}>
              <div className="form-group" style={{marginBottom:8}}>
                <label className="form-label">Symbol</label>
                <select className="form-input form-select" value={symbol} onChange={e=>setSymbol(e.target.value)} style={{padding:'7px 10px'}}>
                  {AllAssets.filter(a=>a.assetType==='stock').map(a=>(
                    <option key={a.symbol} value={a.symbol}>{a.symbol}</option>
                  ))}
                </select>
              </div>
              <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                {['1M','3M','1Y'].map(t=>(
                  <button key={t} className={`btn btn-xs ${tfm===t?'btn-primary':'btn-ghost'}`} onClick={()=>setTfm(t)}>{t}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Chart Preview */}
          <div className="card" style={{padding:12}}>
            <div style={{fontWeight:700,fontSize:13,marginBottom:8}}>Chart Preview</div>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={chartData}>
                <XAxis dataKey="time" hide />
                <YAxis hide />
                <Tooltip contentStyle={{background:'var(--bg-modal)',border:'1px solid var(--border)',borderRadius:8,fontSize:11}}
                  formatter={(v)=>v?.toFixed?.(2)} />
                <defs>
                  <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6c63ff" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6c63ff" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="price" stroke="#6c63ff" fill="url(#priceGrad)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                {mainIndicators.map(ind=>(
                  <Line key={ind.id} type="monotone" dataKey={ind.id} stroke={ind.color} strokeWidth={1} dot={false} isAnimationActive={false} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Column 2: Rule Builder */}
        <div>
          <div className="card card-body" style={{marginBottom:16}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <span style={{fontWeight:700,fontSize:14}}>Trading Rules</span>
              <div style={{display:'flex',gap:8}}>
                <button className="btn btn-green btn-xs" onClick={()=>addRule('BUY')}>+ BUY Rule</button>
                <button className="btn btn-red btn-xs" onClick={()=>addRule('SELL')}>+ SELL Rule</button>
              </div>
            </div>

            {rules.length === 0 && (
              <div style={{textAlign:'center',padding:32,color:'var(--text-muted)'}}>
                <div style={{fontSize:32,marginBottom:8}}>📝</div>
                Add trading rules to define when to buy or sell
              </div>
            )}

            {rules.map((rule, rIdx)=>(
              <div key={rIdx} style={{
                background:'var(--bg-surface)',borderRadius:'var(--radius)',padding:14,marginBottom:10,
                borderLeft:`3px solid ${rule.action==='BUY'?'var(--green)':'var(--red)'}`
              }}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                  <span className={`badge ${rule.action==='BUY'?'badge-bullish':'badge-bearish'}`}>{rule.action}</span>
                  <div style={{display:'flex',gap:6,alignItems:'center'}}>
                    <select value={rule.logic} onChange={e=>updateRule(rIdx,'logic',e.target.value)}
                      style={{background:'var(--bg-input)',border:'1px solid var(--border)',borderRadius:6,padding:'3px 8px',color:'var(--text-secondary)',fontSize:12}}>
                      <option>AND</option><option>OR</option>
                    </select>
                    <button onClick={()=>removeRule(rIdx)} style={{color:'var(--red)',background:'none',fontSize:16,cursor:'pointer'}}>✕</button>
                  </div>
                </div>

                {rule.conditions.map((cond, cIdx)=>(
                  <div key={cIdx} style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap',marginBottom:6}}>
                    <span style={{fontSize:12,color:'var(--text-muted)',minWidth:24}}>when</span>
                    <select
                      value={cond.subject}
                      onChange={e=>{
                        const ref = getReferenceRef(e.target.value);
                        updateCondition(rIdx,cIdx,'subject',e.target.value);
                        updateCondition(rIdx,cIdx,'subjectRef',ref);
                      }}
                      style={{flex:1,background:'var(--bg-input)',border:'1px solid var(--border)',borderRadius:6,padding:'5px 8px',color:'var(--text-primary)',fontSize:12}}>
                      {getSubjectOptions().map(o=>(<option key={o}>{o}</option>))}
                    </select>
                    <select value={cond.operator} onChange={e=>updateCondition(rIdx,cIdx,'operator',e.target.value)}
                      style={{flex:1,background:'var(--bg-input)',border:'1px solid var(--border)',borderRadius:6,padding:'5px 8px',color:'var(--text-primary)',fontSize:12}}>
                      {OPERATORS.map(o=>(<option key={o}>{o}</option>))}
                    </select>
                    <input type="number" value={cond.reference} onChange={e=>updateCondition(rIdx,cIdx,'reference',parseFloat(e.target.value))}
                      style={{width:70,background:'var(--bg-input)',border:'1px solid var(--border)',borderRadius:6,padding:'5px 8px',color:'var(--text-primary)',fontSize:12}} />
                  </div>
                ))}

                <div style={{marginTop:8,padding:'6px 10px',background:'var(--bg-card)',borderRadius:6,fontSize:11,color:'var(--text-secondary)'}}>
                  💬 {rule.action} when {rule.conditions.map(c=>`${c.subject} ${c.operator} ${c.reference}`).join(` ${rule.logic} `)}
                </div>
              </div>
            ))}
          </div>

          {/* Full chart with signals */}
          {backtestResult && (
            <div className="card" style={{padding:16}}>
              <div style={{fontWeight:700,marginBottom:10}}>Strategy Signals on Chart</div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData}>
                  <XAxis dataKey="time" tick={{fontSize:9,fill:'var(--text-muted)'}} tickLine={false} axisLine={false} interval={20} />
                  <YAxis tick={{fontSize:9,fill:'var(--text-muted)'}} width={45} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{background:'var(--bg-modal)',border:'1px solid var(--border)',borderRadius:8,fontSize:11}} />
                  <defs>
                    <linearGradient id="btGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6c63ff" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#6c63ff" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="price" stroke="#6c63ff" fill="url(#btGrad)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Column 3: Backtest */}
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div className="card card-body">
            <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>Backtest</div>
            <div className="form-group" style={{marginBottom:12}}>
              <label className="form-label">Strategy Name</label>
              <input className="form-input" value={stratName} onChange={e=>setStratName(e.target.value)} style={{padding:'7px 10px'}} />
            </div>
            <div className="form-group" style={{marginBottom:16}}>
              <label className="form-label">Description</label>
              <input className="form-input" value={stratDesc} onChange={e=>setStratDesc(e.target.value)} placeholder="Optional" style={{padding:'7px 10px'}} />
            </div>
            <button className="btn btn-primary w-full" onClick={runBT} disabled={isRunning||rules.length===0}>
              {isRunning?'⏳ Running...':'▶ Run Backtest'}
            </button>
            {rules.length===0&&<div style={{fontSize:11,color:'var(--text-muted)',textAlign:'center',marginTop:6}}>Add rules to enable backtest</div>}
          </div>

          {backtestResult && (
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {/* KPI Cards */}
              {[
                {label:'Total Return', value:`${backtestResult.totalReturn}%`, up:backtestResult.totalReturn>=0},
                {label:'vs Buy & Hold', value:`${backtestResult.vsHoldReturn}%`, up:backtestResult.vsHoldReturn>=0},
                {label:'Win Rate', value:`${backtestResult.winRate}%`},
                {label:'Max Drawdown', value:`${backtestResult.maxDrawdown}%`, up:false},
                {label:'Total Trades', value:backtestResult.totalTrades},
                {label:'Profit Factor', value:backtestResult.profitFactor, up:backtestResult.profitFactor>=1},
                {label:'Sharpe Ratio', value:backtestResult.sharpeRatio, up:backtestResult.sharpeRatio>=1},
              ].map(({label,value,up})=>(
                <div key={label} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid var(--border)',fontSize:13}}>
                  <span style={{color:'var(--text-muted)'}}>{label}</span>
                  <span className={up===undefined?'':(up?'positive':'negative')} style={{fontWeight:700}}>{value}</span>
                </div>
              ))}

              {/* Equity Curve */}
              <div className="card" style={{padding:12}}>
                <div style={{fontWeight:700,fontSize:13,marginBottom:8}}>Equity Curve</div>
                <ResponsiveContainer width="100%" height={150}>
                  <AreaChart data={backtestResult.equityCurve.filter((_,i)=>i%3===0)}>
                    <XAxis hide />
                    <YAxis hide />
                    <Tooltip contentStyle={{background:'var(--bg-modal)',border:'1px solid var(--border)',borderRadius:8,fontSize:11}}
                      formatter={(v)=>`₹${v.toLocaleString('en-IN',{maximumFractionDigits:0})}`} />
                    <defs>
                      <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={backtestResult.totalReturn>=0?'#00d084':'#ff4757'} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={backtestResult.totalReturn>=0?'#00d084':'#ff4757'} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <ReferenceLine y={1000000} stroke="var(--text-muted)" strokeDasharray="3 3" />
                    <Area type="monotone" dataKey="value" stroke={backtestResult.totalReturn>=0?'#00d084':'#ff4757'} fill="url(#eqGrad)" strokeWidth={2} dot={false} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Indicator Modal */}
      {showAddInd && (
        <div className="modal-overlay" onClick={()=>setShowAddInd(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Add Indicator</span>
              <button className="modal-close" onClick={()=>setShowAddInd(false)}>×</button>
            </div>
            <div className="form-group" style={{marginBottom:12}}>
              <label className="form-label">Indicator Type</label>
              <select className="form-input form-select" value={newIndType} onChange={e=>{setNewIndType(e.target.value);setNewIndParams({period:20});}}>
                {INDICATOR_TYPES.map(i=>(<option key={i.type} value={i.type}>{i.label}</option>))}
              </select>
            </div>
            {(INDICATOR_TYPES.find(i=>i.type===newIndType)?.params||[]).map(p=>(
              <div className="form-group" key={p.name} style={{marginBottom:12}}>
                <label className="form-label">{p.name}</label>
                <input className="form-input" type="number" defaultValue={p.default}
                  onChange={e=>setNewIndParams(prev=>({...prev,[p.name]:parseInt(e.target.value)||p.default}))} />
              </div>
            ))}
            <button className="btn btn-primary w-full" onClick={addIndicator} style={{marginTop:8}}>Add Indicator</button>
          </div>
        </div>
      )}
    </div>
  );
}
