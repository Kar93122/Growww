import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { subscribeWatchlist, removeFromWatchlist } from '../firebase/firestoreService';
import { generateTickPrice, getAssetInfo } from '../services/assetDataSimulator';

export default function Watchlist() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [watchlist, setWatchlist] = useState([]);
  const [prices, setPrices] = useState({});

  useEffect(() => {
    const unsub = subscribeWatchlist(currentUser.uid, (items) => {
      setWatchlist(items);
      const init = {};
      items.forEach(item => { init[item.symbol] = getAssetInfo(item.symbol).basePrice; });
      setPrices(p => ({...init, ...p}));
    });
    return unsub;
  }, [currentUser.uid]);

  useEffect(() => {
    if (watchlist.length === 0) return;
    const interval = setInterval(() => {
      setPrices(prev => {
        const next = {...prev};
        watchlist.forEach(item => {
          next[item.symbol] = generateTickPrice(item.symbol, prev[item.symbol] || getAssetInfo(item.symbol).basePrice);
        });
        return next;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [watchlist]);

  const getPct = (sym) => {
    const curr = prices[sym];
    if (!curr) return '0.00';
    const base = getAssetInfo(sym).basePrice;
    if (!base) return '0.00';
    return ((curr - base) / base * 100).toFixed(2);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>⭐ Watchlist</h1>
        <p>{watchlist.length} assets tracked · synced to your account</p>
      </div>

      {watchlist.length === 0 ? (
        <div className="card" style={{padding:60,textAlign:'center'}}>
          <div style={{fontSize:48,marginBottom:16}}>📭</div>
          <div style={{fontSize:18,fontWeight:700,marginBottom:8}}>Your watchlist is empty</div>
          <div style={{color:'var(--text-secondary)',marginBottom:24}}>Go to Markets to start tracking assets</div>
          <button className="btn btn-primary" onClick={()=>navigate('/markets')}>Browse Markets</button>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrapper" style={{border:'none',borderRadius:0}}>
            <table className="data-table">
              <thead>
                <tr><th>Asset</th><th>Type</th><th style={{textAlign:'right'}}>Price</th><th style={{textAlign:'right'}}>Change</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {watchlist.map(item => {
                  const info = getAssetInfo(item.symbol);
                  const price = prices[item.symbol] || info.basePrice;
                  const pct = getPct(item.symbol);
                  const up = parseFloat(pct) >= 0;
                  return (
                    <tr key={item.symbol}>
                      <td style={{cursor:'pointer'}} onClick={()=>navigate(`/stock/${item.symbol}`)}>
                        <div style={{fontWeight:600}}>{item.symbol}</div>
                        <div style={{fontSize:12,color:'var(--text-muted)'}}>{info.name}</div>
                      </td>
                      <td><span className={`badge badge-${info.assetType}`}>{info.assetType}</span></td>
                      <td style={{textAlign:'right',fontWeight:700,fontFamily:'monospace'}}>
                        {price >= 1000 ? price.toFixed(0) : price.toFixed(2)}
                      </td>
                      <td style={{textAlign:'right'}} className={up?'positive':'negative'}>
                        <span style={{fontWeight:600}}>{up?'▲':'▼'} {Math.abs(pct)}%</span>
                      </td>
                      <td>
                        <div style={{display:'flex',gap:8}}>
                          <button className="btn btn-secondary btn-xs" onClick={()=>navigate(`/stock/${item.symbol}`)}>View</button>
                          <button className="btn btn-ghost btn-xs" style={{color:'var(--red)'}}
                            onClick={()=>removeFromWatchlist(currentUser.uid, item.symbol)}>✕</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
