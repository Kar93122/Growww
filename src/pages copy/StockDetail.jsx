import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getAssetInfo, generateInitialDataset, generateNextTick } from '../services/assetDataSimulator';
import { detectPatterns } from '../services/patternDetector';
import { compute } from '../services/indicatorEngine';
import { addToWatchlist, removeFromWatchlist, subscribeWatchlist, saveChartSettings, getChartSettings } from '../firebase/firestoreService';

const TIMEFRAMES = ['1D','1W','1M','3M','1Y'];
const CHART_TYPES = ['Candlestick','Line','Bar','Area'];
const INDICATORS = [
  { id:'sma20', label:'SMA 20', type:'SMA', params:{period:20}, color:'#6c63ff', pane:'main' },
  { id:'sma50', label:'SMA 50', type:'SMA', params:{period:50}, color:'#ffd32a', pane:'main' },
  { id:'ema20', label:'EMA 20', type:'EMA', params:{period:20}, color:'#00d4aa', pane:'main' },
  { id:'bb', label:'Bollinger Bands', type:'BB', params:{period:20,stdDev:2}, color:'#ff6b9d', pane:'main' },
  { id:'rsi', label:'RSI 14', type:'RSI', params:{period:14}, color:'#ff9f43', pane:'sub' },
  { id:'macd', label:'MACD', type:'MACD', params:{fast:12,slow:26,signal:9}, color:'#a29bfe', pane:'sub' },
];

const PATTERN_META = {
  bullish: { color:'#00d084', icon:'▲', pos:'aboveBar' },
  bearish: { color:'#ff4757', icon:'▼', pos:'belowBar' },
  neutral: { color:'#8b90b8', icon:'◆', pos:'aboveBar' },
};

export default function StockDetail() {
  const { symbol } = useParams();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const seriesRef = useRef(null);
  const subChartRef = useRef(null);
  const subSeriesRef = useRef(null);
  const indicatorSeriesRef = useRef({});

  const [candles, setCandles] = useState([]);
  const [timeframe, setTimeframe] = useState('1M');
  const [chartType, setChartType] = useState('Candlestick');
  const [activeIndicators, setActiveIndicators] = useState(['sma20']);
  const [patterns, setPatterns] = useState([]);
  const [hoveredPattern, setHoveredPattern] = useState(null);
  const [watchlist, setWatchlist] = useState([]);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [priceChange, setPriceChange] = useState(0);
  const info = getAssetInfo(symbol);

  // Load watchlist
  useEffect(() => {
    const unsub = subscribeWatchlist(currentUser.uid, setWatchlist);
    return unsub;
  }, [currentUser.uid]);

  // Load chart settings
  useEffect(() => {
    getChartSettings(currentUser.uid, symbol)
      .then(snap => {
        if (snap.exists()) {
          const d = snap.data();
          if (d.indicators) setActiveIndicators(d.indicators);
          if (d.timeframe) setTimeframe(d.timeframe);
          if (d.chartType) setChartType(d.chartType);
        }
      })
      .catch(err => {
        console.warn('Failed to load chart settings:', err);
      });
  }, [symbol, currentUser.uid]);

  // Generate candles
  useEffect(() => {
    const data = generateInitialDataset(symbol, timeframe);
    setCandles(data);
    if (data.length > 0) {
      setCurrentPrice(data[data.length-1].close);
      setPriceChange(((data[data.length-1].close - data[0].close) / data[0].close * 100));
    }
    setPatterns(detectPatterns(data));
  }, [symbol, timeframe]);

  // Build chart (simple canvas-based rendering using CSS + SVG approach without LW Charts for now)
  useEffect(() => {
    if (!chartRef.current || candles.length === 0) return;
    renderMiniChart();
  }, [candles, chartType, activeIndicators]);

  const renderMiniChart = () => {
    if (!chartRef.current) return;
    const el = chartRef.current;
    const prices = candles.map(c => c.close);
    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);
    const range = maxP - minP || 1;
    const W = el.clientWidth || 800;
    const H = 300;
    const pts = prices.map((p, i) => [
      (i / (prices.length - 1)) * W,
      H - ((p - minP) / range) * (H - 20) - 10
    ]);
    const d = pts.map((p, i) => `${i===0?'M':'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    const fill = `${d} L${W},${H} L0,${H} Z`;
    const isUp = prices[prices.length-1] >= prices[0];
    const color = isUp ? '#00d084' : '#ff4757';
    const patternMarkers = patterns.slice(-20).map(p => {
      const idx = Math.min(p.candleIndex, prices.length - 1);
      const meta = PATTERN_META[p.signal];
      return { x: (idx/(prices.length-1))*W, y: pts[idx]?.[1] || H/2, meta, p };
    });
    el.innerHTML = `
      <svg width="100%" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block">
        <defs>
          <linearGradient id="grad_${symbol}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${color}" stop-opacity="0.25"/>
            <stop offset="100%" stop-color="${color}" stop-opacity="0.02"/>
          </linearGradient>
        </defs>
        <path d="${fill}" fill="url(#grad_${symbol})" />
        <path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>
        ${patternMarkers.map(({x,y,meta,p}) => `
          <g transform="translate(${x},${meta.pos==='aboveBar'?y-18:y+8})" style="cursor:pointer" class="pattern-marker">
            <circle r="8" fill="${meta.color}" opacity="0.85"/>
            <text text-anchor="middle" dy="4" font-size="9" fill="white">${meta.icon}</text>
          </g>
        `).join('')}
      </svg>
    `;
  };

  // Real-time tick
  useEffect(() => {
    if (candles.length === 0) return;
    const interval = setInterval(() => {
      setCandles(prev => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1];
        const next = generateNextTick(symbol, last);
        const updated = [...prev.slice(-200), next];
        setCurrentPrice(next.close);
        setPriceChange(((next.close - prev[0].close) / prev[0].close * 100));
        setPatterns(detectPatterns(updated.slice(-50)));
        return updated;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [symbol, candles.length > 0]);

  const isWatched = watchlist.some(w => w.symbol === symbol);
  const toggleWatch = () => {
    if (isWatched) removeFromWatchlist(currentUser.uid, symbol);
    else addToWatchlist(currentUser.uid, symbol);
  };

  const toggleIndicator = (id) => {
    const next = activeIndicators.includes(id)
      ? activeIndicators.filter(i => i !== id)
      : [...activeIndicators, id];
    setActiveIndicators(next);
    saveChartSettings(currentUser.uid, symbol, { indicators: next, timeframe, chartType });
  };

  const onTimeframeChange = (tf) => {
    setTimeframe(tf);
    saveChartSettings(currentUser.uid, symbol, { indicators: activeIndicators, timeframe: tf, chartType });
  };

  const onChartTypeChange = (ct) => {
    setChartType(ct);
    saveChartSettings(currentUser.uid, symbol, { indicators: activeIndicators, timeframe, chartType: ct });
  };

  const bullish = patterns.filter(p => p.signal === 'bullish').length;
  const bearish = patterns.filter(p => p.signal === 'bearish').length;
  const priceUp = priceChange >= 0;

  // Compute indicator values for display
  const indicatorValues = {};
  if (candles.length > 0) {
    activeIndicators.forEach(id => {
      const ind = INDICATORS.find(i => i.id === id);
      if (!ind) return;
      const result = compute(ind.type, candles, ind.params);
      if (Array.isArray(result)) {
        indicatorValues[id] = result[result.length - 1];
      } else if (result && typeof result === 'object') {
        const keys = Object.keys(result);
        indicatorValues[id] = result[keys[0]]?.[result[keys[0]].length - 1];
      }
    });
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:20}}>
        <div>
          <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:6}}>
            <button onClick={()=>navigate(-1)} className="btn btn-ghost btn-sm">← Back</button>
            <span className={`badge badge-${info.assetType}`}>{info.assetType}</span>
            <span style={{color:'var(--text-muted)',fontSize:13}}>{info.sector}</span>
          </div>
          <h1 style={{fontSize:22,fontWeight:900}}>{symbol} <span style={{fontSize:14,fontWeight:500,color:'var(--text-secondary)'}}>{info.name}</span></h1>
          <div style={{display:'flex',alignItems:'baseline',gap:12,marginTop:8}}>
            <span style={{fontSize:32,fontWeight:800,fontFamily:'monospace'}}>
              {currentPrice >= 1000 ? currentPrice.toFixed(0) : currentPrice.toFixed(2)}
            </span>
            <span className={priceUp?'positive':'negative'} style={{fontWeight:600,fontSize:16}}>
              {priceUp?'▲':'▼'} {Math.abs(priceChange).toFixed(2)}%
            </span>
            <span style={{fontSize:12,color:'var(--text-muted)'}}>LIVE SIM</span>
          </div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <button className={`btn ${isWatched?'btn-secondary':'btn-primary'} btn-sm`} onClick={toggleWatch}>
            {isWatched?'★ Watching':'☆ Add to Watchlist'}
          </button>
          <button className="btn btn-green btn-sm" onClick={()=>navigate('/simulator')}>Trade →</button>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 280px',gap:20}}>
        {/* Chart area */}
        <div>
          {/* Controls */}
          <div className="card" style={{padding:'12px 16px',marginBottom:12}}>
            <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
              <div className="tabs" style={{padding:3}}>
                {TIMEFRAMES.map(tf=>(
                  <button key={tf} className={`tab-btn${timeframe===tf?' active':''}`}
                    onClick={()=>onTimeframeChange(tf)} style={{padding:'6px 12px',flex:'none'}}>{tf}</button>
                ))}
              </div>
              <div className="tabs" style={{padding:3}}>
                {CHART_TYPES.map(ct=>(
                  <button key={ct} className={`tab-btn${chartType===ct?' active':''}`}
                    onClick={()=>onChartTypeChange(ct)} style={{padding:'6px 12px',flex:'none',fontSize:12}}>{ct}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="chart-container" style={{height:300,marginBottom:12}}>
            <div ref={chartRef} style={{width:'100%',height:300}} />
          </div>

          {/* Indicator Values */}
          {activeIndicators.length > 0 && (
            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:12}}>
              {activeIndicators.map(id=>{
                const ind = INDICATORS.find(i=>i.id===id);
                const val = indicatorValues[id];
                return (
                  <div key={id} style={{background:'var(--bg-card)',border:`1px solid ${ind.color}40`,borderRadius:'var(--radius-sm)',padding:'4px 10px',fontSize:12}}>
                    <span style={{color:ind.color,fontWeight:600}}>{ind.label}</span>
                    {val != null && <span style={{color:'var(--text-secondary)',marginLeft:6}}>{parseFloat(val).toFixed(2)}</span>}
                  </div>
                );
              })}
            </div>
          )}

          {/* Pattern Signal Summary */}
          <div className="card" style={{padding:16}}>
            <div style={{fontWeight:700,marginBottom:12}}>Pattern Signals ({patterns.length} detected)</div>
            <div style={{display:'flex',gap:16}}>
              <div style={{textAlign:'center'}}>
                <div style={{fontSize:24,fontWeight:800,color:'var(--green)'}}>{bullish}</div>
                <div style={{fontSize:11,color:'var(--text-muted)'}}>Bullish</div>
              </div>
              <div style={{textAlign:'center'}}>
                <div style={{fontSize:24,fontWeight:800,color:'var(--red)'}}>{bearish}</div>
                <div style={{fontSize:11,color:'var(--text-muted)'}}>Bearish</div>
              </div>
              <div style={{textAlign:'center'}}>
                <div style={{fontSize:24,fontWeight:800,color:'var(--text-secondary)'}}>{patterns.length - bullish - bearish}</div>
                <div style={{fontSize:11,color:'var(--text-muted)'}}>Neutral</div>
              </div>
            </div>
            {patterns.slice(-5).reverse().map((p,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',gap:10,marginTop:10,padding:'8px 12px',background:'var(--bg-surface)',borderRadius:'var(--radius-sm)'}}>
                <span className={`badge badge-${p.signal}`}>{p.signal}</span>
                <div style={{flex:1}}>
                  <div style={{fontWeight:600,fontSize:13}}>{p.pattern}</div>
                  <div style={{fontSize:11,color:'var(--text-muted)'}}>{p.description}</div>
                </div>
                <div style={{fontSize:11,color:'var(--text-secondary)',whiteSpace:'nowrap'}}>{p.confidence}% conf.</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel */}
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          {/* Asset Info */}
          <div className="card card-body">
            <div className="card-title" style={{marginBottom:12}}>Asset Info</div>
            {[['Symbol',symbol],['Full Name',info.name],['Type',info.assetType],['Sector',info.sector],['Volatility',(info.volatility*100).toFixed(1)+'%']].map(([k,v])=>(
              <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid var(--border)',fontSize:13}}>
                <span style={{color:'var(--text-muted)'}}>{k}</span>
                <span style={{fontWeight:600}}>{v}</span>
              </div>
            ))}
          </div>

          {/* Indicators */}
          <div className="card card-body">
            <div className="card-title" style={{marginBottom:12}}>Indicators</div>
            {INDICATORS.map(ind=>(
              <div key={ind.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 0'}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <div style={{width:10,height:10,borderRadius:2,background:ind.color}} />
                  <span style={{fontSize:13}}>{ind.label}</span>
                </div>
                <label className="toggle">
                  <input type="checkbox" checked={activeIndicators.includes(ind.id)}
                    onChange={()=>toggleIndicator(ind.id)} />
                  <span className="toggle-slider" />
                </label>
              </div>
            ))}
          </div>

          {/* Quick Trade */}
          <div className="card card-body" style={{background:'linear-gradient(135deg,rgba(108,99,255,0.1),rgba(0,212,170,0.05))'}}>
            <div className="card-title" style={{marginBottom:12}}>Quick Trade</div>
            <p style={{fontSize:12,color:'var(--text-secondary)',marginBottom:16}}>Use the simulator to practice trading {symbol} with virtual money.</p>
            <button className="btn btn-primary w-full" onClick={()=>navigate('/simulator')}>
              Open Simulator →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
