import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AllAssets, generateTickPrice } from '../services/assetDataSimulator';
import { addToWatchlist, removeFromWatchlist, subscribeWatchlist } from '../firebase/firestoreService';

const TYPES = ['All', 'stock', 'crypto', 'bond'];
const SECTORS = ['All', 'Technology', 'Finance', 'Energy', 'Consumer', 'Automotive', 'Entertainment', 'Crypto', 'Bond'];

export default function Markets() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [prices, setPrices] = useState({});
  const [prevPrices, setPrevPrices] = useState({});
  const [watchlist, setWatchlist] = useState([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [sectorFilter, setSectorFilter] = useState('All');

  useEffect(() => {
    const init = {};
    AllAssets.forEach(a => { init[a.symbol] = a.basePrice; });
    setPrices(init);
    const unsub = subscribeWatchlist(currentUser.uid, setWatchlist);
    const interval = setInterval(() => {
      setPrevPrices(p => ({...p, ...prices}));
      setPrices(prev => {
        const next = {...prev};
        AllAssets.forEach(a => { next[a.symbol] = generateTickPrice(a.symbol, prev[a.symbol] || a.basePrice); });
        return next;
      });
    }, 2500);
    return () => { clearInterval(interval); unsub?.(); };
  }, [currentUser.uid]);

  const filtered = AllAssets.filter(a => {
    const matchSearch = a.symbol.toLowerCase().includes(search.toLowerCase()) ||
      a.name.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'All' || a.assetType === typeFilter;
    const matchSector = sectorFilter === 'All' || a.sector === sectorFilter;
    return matchSearch && matchType && matchSector;
  });

  const getPct = (sym, base) => {
    const curr = prices[sym]; const prev = prevPrices[sym] || base;
    if (!curr || !prev) return '0.00';
    return ((curr - prev) / prev * 100).toFixed(2);
  };

  const isWatched = (sym) => watchlist.some(w => w.symbol === sym);
  const toggleWatch = (e, sym) => {
    e.stopPropagation();
    if (isWatched(sym)) removeFromWatchlist(currentUser.uid, sym);
    else addToWatchlist(currentUser.uid, sym);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Markets</h1>
        <p>Browse and track stocks, crypto, and bonds with live simulated prices</p>
      </div>

      {/* Filters */}
      <div style={{display:'flex',gap:12,marginBottom:20,flexWrap:'wrap'}}>
        <input className="form-input" placeholder="🔍 Search symbol or name..." style={{maxWidth:280}}
          value={search} onChange={e=>setSearch(e.target.value)} />
        <div className="tabs" style={{background:'transparent',gap:4}}>
          {TYPES.map(t=>(
            <button key={t} className={`tab-btn${typeFilter===t?' active':''}`}
              onClick={()=>setTypeFilter(t)} style={{padding:'8px 14px',flex:'none'}}>
              {t.charAt(0).toUpperCase()+t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="table-wrapper" style={{border:'none',borderRadius:0}}>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th><th>Asset</th><th>Type</th><th>Sector</th>
                <th style={{textAlign:'right'}}>Price</th>
                <th style={{textAlign:'right'}}>Change</th>
                <th>Watchlist</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((asset, i) => {
                const price = prices[asset.symbol] || asset.basePrice;
                const pct = getPct(asset.symbol, asset.basePrice);
                const up = parseFloat(pct) >= 0;
                return (
                  <tr key={asset.symbol} style={{cursor:'pointer'}}
                    onClick={()=>navigate(`/stock/${asset.symbol}`)}>
                    <td style={{color:'var(--text-muted)',width:40}}>{i+1}</td>
                    <td>
                      <div style={{fontWeight:600}}>{asset.symbol}</div>
                      <div style={{fontSize:12,color:'var(--text-muted)'}}>{asset.name}</div>
                    </td>
                    <td><span className={`badge badge-${asset.assetType}`}>{asset.assetType}</span></td>
                    <td style={{color:'var(--text-secondary)',fontSize:13}}>{asset.sector}</td>
                    <td style={{textAlign:'right',fontWeight:700,fontFamily:'JetBrains Mono,monospace'}}>
                      {price >= 1000 ? price.toFixed(0) : price.toFixed(2)}
                    </td>
                    <td style={{textAlign:'right'}} className={up?'positive':'negative'}>
                      <span style={{fontWeight:600}}>{up?'▲':'▼'} {Math.abs(pct)}%</span>
                    </td>
                    <td onClick={e=>toggleWatch(e, asset.symbol)}>
                      <button className={`btn btn-xs ${isWatched(asset.symbol)?'btn-secondary':'btn-ghost'}`}>
                        {isWatched(asset.symbol)?'★ Watching':'☆ Watch'}
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
