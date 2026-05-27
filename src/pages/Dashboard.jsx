import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { generateTickPrice, AllAssets, getAssetInfo } from '../services/assetDataSimulator';
import { addToWatchlist, subscribeWatchlist } from '../firebase/firestoreService';

const MARKET_INDICES = [
  { symbol: 'NIFTY50', name: 'NIFTY 50', price: 22543.25 },
  { symbol: 'SENSEX', name: 'BSE SENSEX', price: 74119.3 },
  { symbol: 'BANKNIFTY', name: 'BANK NIFTY', price: 48312.8 },
];

const FEATURED = ['AAPL','TSLA','BTC','ETH','RELIANCE','NVDA','INFY','MSFT'];

export default function Dashboard() {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  const [prices, setPrices] = useState({});
  const [watchlist, setWatchlist] = useState([]);
  const [indices, setIndices] = useState(MARKET_INDICES);

  useEffect(() => {
    // Init prices
    const init = {};
    FEATURED.forEach(s => { init[s] = getAssetInfo(s).basePrice; });
    MARKET_INDICES.forEach(i => { init[i.symbol] = i.price; });
    setPrices(init);

    const unsub = subscribeWatchlist(currentUser.uid, setWatchlist);

    const interval = setInterval(() => {
      setPrices(prev => {
        const next = {...prev};
        FEATURED.forEach(s => { next[s] = generateTickPrice(s, prev[s] || getAssetInfo(s).basePrice); });
        MARKET_INDICES.forEach(idx => {
          next[idx.symbol] = parseFloat((prev[idx.symbol] * (1 + (Math.random()-0.495)*0.002)).toFixed(2));
        });
        return next;
      });
    }, 2000);

    return () => { clearInterval(interval); unsub?.(); };
  }, [currentUser.uid]);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const formatPrice = (p, sym) => {
    const info = getAssetInfo(sym);
    if (info.assetType === 'bond') return p?.toFixed(2);
    if (p >= 1000) return p?.toFixed(0);
    return p?.toFixed(2);
  };

  const getPct = (sym) => {
    const curr = prices[sym];
    if (!curr) return '0.00';
    const indexInfo = MARKET_INDICES.find(i => i.symbol === sym);
    const base = indexInfo ? indexInfo.price : getAssetInfo(sym).basePrice;
    if (!base) return '0.00';
    return ((curr - base) / base * 100).toFixed(2);
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{marginBottom:28}}>
        <h1 style={{fontSize:26,fontWeight:800,color:'var(--text-primary)'}}>
          {greeting()}, {userProfile?.displayName?.split(' ')[0] || (currentUser?.email ? currentUser.email.split('@')[0].charAt(0).toUpperCase() + currentUser.email.split('@')[0].slice(1) : 'Trader')} 👋
        </h1>
        <p style={{color:'var(--text-secondary)',marginTop:4}}>Here's what the simulated markets are doing today.</p>
      </div>

      {/* Indices */}
      <div className="grid-3" style={{marginBottom:24}}>
        {MARKET_INDICES.map(idx => {
          const p = prices[idx.symbol] || idx.price;
          const pct = getPct(idx.symbol);
          const up = parseFloat(pct) >= 0;
          return (
            <div className="kpi-card" key={idx.symbol}>
              <div className="kpi-label">{idx.name}</div>
              <div className={`kpi-value ${up?'positive':'negative'}`} style={{fontSize:20}}>
                {p?.toLocaleString('en-IN', {maximumFractionDigits:2})}
              </div>
              <div className={`kpi-sub ${up?'positive':'negative'}`}>
                {up?'▲':'▼'} {Math.abs(pct)}%
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="grid-4" style={{marginBottom:24}}>
        {[
          { icon:'💼', label:'Simulator', sub:'₹10L virtual cash', path:'/simulator', color:'var(--primary)' },
          { icon:'📊', label:'Multi-Chart', sub:'Compare assets', path:'/multi-chart', color:'var(--accent)' },
          { icon:'⚙️', label:'Strategy Builder', sub:'Build & backtest', path:'/strategy', color:'#ffd32a' },
          { icon:'⭐', label:'Watchlist', sub:`${watchlist.length} stocks`, path:'/watchlist', color:'#ff6b9d' },
        ].map(({ icon, label, sub, path, color }) => (
          <div key={label} className="card" style={{padding:20,cursor:'pointer',transition:'all 0.2s'}}
            onClick={()=>navigate(path)}
            onMouseOver={e=>e.currentTarget.style.borderColor=color}
            onMouseOut={e=>e.currentTarget.style.borderColor='var(--border)'}
          >
            <div style={{fontSize:32,marginBottom:10}}>{icon}</div>
            <div style={{fontWeight:700,fontSize:15}}>{label}</div>
            <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Featured Assets */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Featured Assets</span>
          <button className="btn btn-ghost btn-sm" onClick={()=>navigate('/markets')}>View All →</button>
        </div>
        <div className="table-wrapper" style={{border:'none',borderRadius:0}}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Asset</th><th>Type</th><th>Price</th><th>Change</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {FEATURED.map(sym => {
                const info = getAssetInfo(sym);
                const price = prices[sym] || info.basePrice;
                const pct = getPct(sym);
                const up = parseFloat(pct) >= 0;
                return (
                  <tr key={sym} style={{cursor:'pointer'}} onClick={()=>navigate(`/stock/${sym}`)}>
                    <td>
                      <div style={{fontWeight:600}}>{sym}</div>
                      <div style={{fontSize:12,color:'var(--text-muted)'}}>{info.name}</div>
                    </td>
                    <td>
                      <span className={`badge badge-${info.assetType}`}>{info.assetType}</span>
                    </td>
                    <td className="font-mono" style={{fontWeight:600}}>
                      {formatPrice(price, sym)}
                    </td>
                    <td className={up?'positive':'negative'} style={{fontWeight:600}}>
                      {up?'▲':'▼'} {Math.abs(pct)}%
                    </td>
                    <td onClick={e=>e.stopPropagation()}>
                      <button className="btn btn-secondary btn-xs"
                        onClick={()=>addToWatchlist(currentUser.uid, sym)}
                        disabled={watchlist.some(w=>w.symbol===sym)}
                      >
                        {watchlist.some(w=>w.symbol===sym)?'✓ Watching':'+ Watch'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
