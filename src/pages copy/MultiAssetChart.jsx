import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { AllAssets, generateInitialDataset, generateNextTick, getAssetInfo } from '../services/assetDataSimulator';
import { detectPatterns } from '../services/patternDetector';
import { saveMultiAssetChart, getMultiAssetCharts } from '../firebase/firestoreService';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const ASSET_COLORS = ['#6c63ff','#00d4aa','#ffd32a','#ff4757','#ff9f43','#a29bfe','#26de81','#4bcffa','#fd79a8','#badc58'];

const pearsonCorrelation = (a, b) => {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  const ax = a.slice(-n), bx = b.slice(-n);
  const ma = ax.reduce((s,v)=>s+v,0)/n;
  const mb = bx.reduce((s,v)=>s+v,0)/n;
  const num = ax.reduce((s,v,i)=>s+(v-ma)*(bx[i]-mb),0);
  const da = Math.sqrt(ax.reduce((s,v)=>s+Math.pow(v-ma,2),0));
  const db = Math.sqrt(bx.reduce((s,v)=>s+Math.pow(v-mb,2),0));
  return da===0||db===0?0:parseFloat((num/(da*db)).toFixed(3));
};

const corrColor = (v) => {
  if (v > 0.7) return '#00d084';
  if (v > 0.3) return '#a0e080';
  if (v > -0.3) return '#8b90b8';
  if (v > -0.7) return '#ff9f8a';
  return '#ff4757';
};

export default function MultiAssetChart() {
  const { currentUser } = useAuth();
  const [assets, setAssets] = useState([
    { symbol:'AAPL', assetType:'stock', chartType:'Line', color:ASSET_COLORS[0], visible:true },
    { symbol:'BTC',  assetType:'crypto', chartType:'Line', color:ASSET_COLORS[1], visible:true },
  ]);
  const [timeframe, setTimeframe] = useState('1M');
  const [normalized, setNormalized] = useState(false);
  const [candleData, setCandleData] = useState({});
  const [chartPoints, setChartPoints] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [isRunning, setIsRunning] = useState(true);
  const [savedCharts, setSavedCharts] = useState([]);
  const [chartName, setChartName] = useState('My Chart');
  const intervalRef = useRef(null);

  // Load candle data per asset
  useEffect(() => {
    const newData = {};
    assets.forEach(a => { newData[a.symbol] = generateInitialDataset(a.symbol, timeframe); });
    setCandleData(newData);
  }, [assets.map(a=>a.symbol).join(','), timeframe]);

  // Build normalized chart points
  useEffect(() => {
    if (Object.keys(candleData).length === 0) return;
    const allTimes = new Set();
    Object.values(candleData).forEach(arr => arr.forEach(c => allTimes.add(c.time)));
    const times = Array.from(allTimes).sort();
    const baseValues = {};
    assets.forEach(a => {
      const arr = candleData[a.symbol];
      if (arr && arr.length > 0) baseValues[a.symbol] = arr[0].close;
    });
    const pts = times.slice(-120).map(t => {
      const pt = { time: new Date(t*1000).toLocaleDateString('en-IN',{month:'short',day:'numeric'}) };
      assets.forEach(a => {
        if (!a.visible) return;
        const arr = candleData[a.symbol];
        if (!arr) return;
        const candle = arr.find(c=>c.time===t) || arr[arr.length-1];
        if (candle) {
          pt[a.symbol] = normalized
            ? parseFloat(((candle.close - baseValues[a.symbol]) / baseValues[a.symbol] * 100).toFixed(3))
            : candle.close;
        }
      });
      return pt;
    });
    setChartPoints(pts);
  }, [candleData, normalized, assets]);

  // Real-time tick
  useEffect(() => {
    if (!isRunning) return;
    intervalRef.current = setInterval(() => {
      setCandleData(prev => {
        const next = {...prev};
        assets.forEach(a => {
          if (!prev[a.symbol] || prev[a.symbol].length === 0) return;
          const last = prev[a.symbol][prev[a.symbol].length-1];
          const newCandle = generateNextTick(a.symbol, last);
          next[a.symbol] = [...prev[a.symbol].slice(-300), newCandle];
        });
        return next;
      });
    }, 1500);
    return () => clearInterval(intervalRef.current);
  }, [isRunning, assets]);

  const addAsset = (assetInfo) => {
    if (assets.find(a=>a.symbol===assetInfo.symbol)) return;
    const color = ASSET_COLORS[assets.length % ASSET_COLORS.length];
    setAssets(prev => [...prev, { symbol:assetInfo.symbol, assetType:assetInfo.assetType, chartType:'Line', color, visible:true }]);
    setSearchOpen(false);
  };

  const removeAsset = (sym) => setAssets(prev => prev.filter(a=>a.symbol!==sym));
  const toggleVisible = (sym) => setAssets(prev => prev.map(a=>a.symbol===sym?{...a,visible:!a.visible}:a));
  const setAssetColor = (sym, color) => setAssets(prev => prev.map(a=>a.symbol===sym?{...a,color}:a));
  const setAssetChartType = (sym, ct) => setAssets(prev => prev.map(a=>a.symbol===sym?{...a,chartType:ct}:a));

  const saveChart = async () => {
    await saveMultiAssetChart(currentUser.uid, Date.now().toString(), {
      name: chartName, assets, timeframe, createdAt: new Date().toISOString()
    });
  };

  // Correlation matrix
  const corrMatrix = assets.map(a1 => assets.map(a2 => {
    if (a1.symbol === a2.symbol) return 1;
    const arr1 = (candleData[a1.symbol]||[]).map(c=>c.close);
    const arr2 = (candleData[a2.symbol]||[]).map(c=>c.close);
    return pearsonCorrelation(arr1, arr2);
  }));

  // Performance
  const perfData = assets.map(a => {
    const arr = candleData[a.symbol] || [];
    if (arr.length < 2) return { ...a, chg:0, price:0, vol:0 };
    const first = arr[0].close; const last = arr[arr.length-1].close;
    const prices = arr.map(c=>c.close);
    const mean = prices.reduce((s,v)=>s+v,0)/prices.length;
    const vol = Math.sqrt(prices.reduce((s,v)=>s+Math.pow(v-mean,2),0)/prices.length)/mean*100;
    return { ...a, price:last, chg:((last-first)/first*100), vol:vol.toFixed(1) };
  });

  const filteredSearch = AllAssets.filter(a =>
    a.symbol.toLowerCase().includes(searchQ.toLowerCase()) ||
    a.name.toLowerCase().includes(searchQ.toLowerCase())
  ).filter(a => !assets.find(x=>x.symbol===a.symbol));

  const TIMEFRAMES = ['1D','1W','1M','3M','1Y'];

  return (
    <div className="page-container">
      <div className="page-header" style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
        <div>
          <h1>📊 Multi-Asset Chart</h1>
          <p>Compare multiple assets on one canvas with real-time simulated data</p>
        </div>
        <div style={{display:'flex',gap:8}}>
          <input className="form-input" value={chartName} onChange={e=>setChartName(e.target.value)}
            style={{width:160,padding:'7px 12px',fontSize:13}} placeholder="Chart name" />
          <button className="btn btn-secondary btn-sm" onClick={saveChart}>💾 Save</button>
          <button className="btn btn-ghost btn-sm" onClick={()=>setIsRunning(r=>!r)}>
            {isRunning?'⏸ Pause':'▶ Resume'}
          </button>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'260px 1fr 260px',gap:20,alignItems:'start'}}>
        {/* Left: Asset Sidebar */}
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div className="card card-body">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
              <span style={{fontWeight:700,fontSize:14}}>Assets ({assets.length})</span>
              <button className="btn btn-primary btn-xs" onClick={()=>setSearchOpen(true)}>+ Add</button>
            </div>
            {assets.map(a => {
              const perf = perfData.find(p=>p.symbol===a.symbol);
              return (
                <div key={a.symbol} style={{background:'var(--bg-surface)',borderRadius:'var(--radius)',padding:10,marginBottom:8,border:`1px solid ${a.color}30`}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                    <div style={{display:'flex',alignItems:'center',gap:6}}>
                      <div style={{width:10,height:10,borderRadius:2,background:a.color,flexShrink:0}} />
                      <span style={{fontWeight:700,fontSize:13}}>{a.symbol}</span>
                      <span className={`badge badge-${a.assetType}`} style={{fontSize:9}}>{a.assetType}</span>
                    </div>
                    <div style={{display:'flex',gap:4}}>
                      <button onClick={()=>toggleVisible(a.symbol)} title={a.visible?'Hide':'Show'}
                        style={{fontSize:14,color:a.visible?a.color:'var(--text-muted)',background:'none',cursor:'pointer'}}>
                        {a.visible?'👁':'🚫'}
                      </button>
                      <button onClick={()=>removeAsset(a.symbol)}
                        style={{fontSize:12,color:'var(--red)',background:'none',cursor:'pointer'}}>✕</button>
                    </div>
                  </div>
                  <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                    {['Line','Area','Bar'].map(ct=>(
                      <button key={ct} onClick={()=>setAssetChartType(a.symbol,ct)}
                        className={`btn btn-xs ${a.chartType===ct?'btn-primary':'btn-ghost'}`}>
                        {ct}
                      </button>
                    ))}
                  </div>
                  {perf && (
                    <div style={{marginTop:6,fontSize:11,display:'flex',justifyContent:'space-between'}}>
                      <span style={{color:'var(--text-muted)'}}>{perf.price>=1000?perf.price.toFixed(0):perf.price.toFixed(2)}</span>
                      <span className={perf.chg>=0?'positive':'negative'}>{perf.chg>=0?'+':''}{perf.chg.toFixed(2)}%</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Timeframe + Normalize */}
          <div className="card card-body">
            <div style={{fontWeight:700,fontSize:14,marginBottom:10}}>Settings</div>
            <div style={{marginBottom:10}}>
              <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:6}}>Timeframe</div>
              <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                {TIMEFRAMES.map(tf=>(
                  <button key={tf} className={`btn btn-xs ${timeframe===tf?'btn-primary':'btn-ghost'}`}
                    onClick={()=>setTimeframe(tf)}>{tf}</button>
                ))}
              </div>
            </div>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <span style={{fontSize:13}}>% Normalized</span>
              <label className="toggle">
                <input type="checkbox" checked={normalized} onChange={()=>setNormalized(n=>!n)} />
                <span className="toggle-slider" />
              </label>
            </div>
          </div>
        </div>

        {/* Center: Chart */}
        <div>
          <div className="card" style={{padding:20,marginBottom:16}}>
            <ResponsiveContainer width="100%" height={380}>
              <LineChart data={chartPoints}>
                <XAxis dataKey="time" tick={{fontSize:10,fill:'var(--text-muted)'}} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{fontSize:10,fill:'var(--text-muted)'}} tickLine={false} axisLine={false} width={60}
                  tickFormatter={v=>normalized?`${v}%`:v>=1000?v.toFixed(0):v.toFixed(2)} />
                <Tooltip
                  contentStyle={{background:'var(--bg-modal)',border:'1px solid var(--border)',borderRadius:8,fontSize:12}}
                  formatter={(v,n)=>[normalized?`${v.toFixed(2)}%`:(v>=1000?v.toFixed(0):v.toFixed(2)),n]}
                />
                <Legend wrapperStyle={{fontSize:12}} />
                {assets.filter(a=>a.visible).map(a=>(
                  <Line key={a.symbol} type="monotone" dataKey={a.symbol}
                    stroke={a.color} strokeWidth={2} dot={false}
                    strokeDasharray={a.assetType==='bond'?'4 2':undefined}
                    activeDot={{r:4,fill:a.color}}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Performance Table */}
          <div className="card">
            <div className="card-header"><span className="card-title">Performance Summary</span></div>
            <div className="table-wrapper" style={{border:'none',borderRadius:0}}>
              <table className="data-table">
                <thead><tr><th>Asset</th><th>Type</th><th style={{textAlign:'right'}}>Price</th><th style={{textAlign:'right'}}>Perf ({timeframe})</th><th style={{textAlign:'right'}}>Volatility</th><th>Trend</th></tr></thead>
                <tbody>
                  {perfData.map(p=>(
                    <tr key={p.symbol}>
                      <td><div style={{display:'flex',alignItems:'center',gap:8}}><div style={{width:8,height:8,borderRadius:1,background:p.color}}/><span style={{fontWeight:700}}>{p.symbol}</span></div></td>
                      <td><span className={`badge badge-${p.assetType}`}>{p.assetType}</span></td>
                      <td style={{textAlign:'right',fontFamily:'monospace',fontWeight:600}}>{p.price>=1000?p.price.toFixed(0):p.price.toFixed(2)}</td>
                      <td style={{textAlign:'right'}} className={p.chg>=0?'positive':'negative'}><span style={{fontWeight:700}}>{p.chg>=0?'+':''}{p.chg.toFixed(2)}%</span></td>
                      <td style={{textAlign:'right',color:'var(--text-secondary)'}}>{p.vol}%</td>
                      <td>{p.chg>1?'📈 Up':p.chg<-1?'📉 Down':'➡ Flat'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: Correlation Matrix */}
        <div>
          <div className="card card-body" style={{marginBottom:16}}>
            <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>Correlation Matrix</div>
            {assets.length < 2 ? (
              <div style={{fontSize:12,color:'var(--text-muted)'}}>Add 2+ assets to see correlations</div>
            ) : (
              <div style={{overflowX:'auto'}}>
                <table style={{borderCollapse:'collapse',fontSize:11,width:'100%'}}>
                  <thead>
                    <tr>
                      <th style={{padding:'4px 6px',color:'var(--text-muted)'}}></th>
                      {assets.map(a=>(<th key={a.symbol} style={{padding:'4px 6px',color:'var(--text-secondary)',textAlign:'center'}}>{a.symbol}</th>))}
                    </tr>
                  </thead>
                  <tbody>
                    {assets.map((a1,i)=>(
                      <tr key={a1.symbol}>
                        <td style={{padding:'4px 6px',color:'var(--text-secondary)',fontWeight:600}}>{a1.symbol}</td>
                        {assets.map((a2,j)=>{
                          const v = corrMatrix[i]?.[j] ?? 0;
                          return (
                            <td key={a2.symbol} title={`${a1.symbol} vs ${a2.symbol}: ${v}`}
                              style={{padding:'4px',textAlign:'center',cursor:'help'}}>
                              <div style={{background:corrColor(v)+'33',borderRadius:4,padding:'4px 2px',color:corrColor(v),fontWeight:700}}>
                                {v.toFixed(2)}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{marginTop:10,fontSize:10,color:'var(--text-muted)'}}>
                  <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                    {[['■ >0.7','#00d084'],['■ 0.3-0.7','#a0e080'],['■ near 0','#8b90b8'],['■ negative','#ff4757']].map(([l,c])=>(
                      <span key={l} style={{color:c}}>{l}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Live ticker */}
          <div className="card card-body">
            <div style={{fontWeight:700,fontSize:14,marginBottom:10}}>Live Prices
              <span style={{display:'inline-block',width:6,height:6,borderRadius:'50%',background:'var(--green)',marginLeft:8,animation:'ping 1s infinite'}} />
            </div>
            {assets.map(a=>{
              const arr = candleData[a.symbol]||[];
              const last = arr[arr.length-1];
              const prev = arr[arr.length-2];
              if (!last) return null;
              const up = !prev || last.close >= prev.close;
              return (
                <div key={a.symbol} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 0',borderBottom:'1px solid var(--border)'}}>
                  <div style={{display:'flex',alignItems:'center',gap:6}}>
                    <div style={{width:6,height:6,borderRadius:1,background:a.color}} />
                    <span style={{fontWeight:600,fontSize:13}}>{a.symbol}</span>
                  </div>
                  <span className={up?'positive':'negative'} style={{fontFamily:'monospace',fontWeight:700,fontSize:13}}>
                    {last.close>=1000?last.close.toFixed(0):last.close.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Asset Search Modal */}
      {searchOpen && (
        <div className="modal-overlay" onClick={()=>setSearchOpen(false)}>
          <div className="modal" style={{maxWidth:520}} onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Add Asset</span>
              <button className="modal-close" onClick={()=>setSearchOpen(false)}>×</button>
            </div>
            <input className="form-input" placeholder="Search by symbol or name..."
              value={searchQ} onChange={e=>setSearchQ(e.target.value)}
              style={{marginBottom:12}} autoFocus />
            <div style={{maxHeight:320,overflowY:'auto'}}>
              {filteredSearch.map(a=>(
                <div key={a.symbol} onClick={()=>addAsset(a)}
                  style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 12px',borderRadius:'var(--radius-sm)',cursor:'pointer',transition:'background 0.15s'}}
                  onMouseOver={e=>e.currentTarget.style.background='var(--bg-card-hover)'}
                  onMouseOut={e=>e.currentTarget.style.background='transparent'}>
                  <div>
                    <div style={{fontWeight:700}}>{a.symbol}</div>
                    <div style={{fontSize:12,color:'var(--text-muted)'}}>{a.name}</div>
                  </div>
                  <span className={`badge badge-${a.assetType}`}>{a.assetType}</span>
                </div>
              ))}
              {filteredSearch.length===0&&<div style={{textAlign:'center',color:'var(--text-muted)',padding:20}}>No results</div>}
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes ping{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
    </div>
  );
}
