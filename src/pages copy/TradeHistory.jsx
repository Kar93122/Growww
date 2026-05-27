import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { subscribeTradeHistory } from '../firebase/firestoreService';
import { computeRealizedPnL } from '../services/tradeEngine';

export default function TradeHistory() {
  const { currentUser } = useAuth();
  const [trades, setTrades] = useState([]);
  const [filter, setFilter] = useState({ symbol:'', action:'All' });

  useEffect(() => {
    const unsub = subscribeTradeHistory(currentUser.uid, setTrades);
    return unsub;
  }, [currentUser.uid]);

  const filtered = trades.filter(t => {
    const matchSym = !filter.symbol || t.symbol?.toLowerCase().includes(filter.symbol.toLowerCase());
    const matchAct = filter.action === 'All' || t.action === filter.action;
    return matchSym && matchAct;
  });

  const totalRealized = computeRealizedPnL(filtered);
  const totalFees = filtered.reduce((s,t)=>s+(t.transactionFee||0),0);

  const exportCSV = () => {
    const headers = 'Symbol,Action,Qty,Price,Trade Value,Fees,Net Amount,Realized P&L,Date\n';
    const rows = filtered.map(t => [
      t.symbol, t.action, t.qty, t.priceAtExecution, t.totalValue,
      t.transactionFee, t.netAmount, t.realizedPnL||0,
      t.timestamp?.toDate?.()?.toLocaleDateString?.() || 'N/A'
    ].join(',')).join('\n');
    const blob = new Blob([headers+rows], {type:'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download='trades.csv'; a.click();
  };

  return (
    <div className="page-container">
      <div className="page-header" style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
        <div>
          <h1>📋 Trade History</h1>
          <p>Complete log of all simulated trades</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={exportCSV}>📄 Export CSV</button>
      </div>

      {/* Summary */}
      <div className="grid-3" style={{marginBottom:24}}>
        <div className="kpi-card">
          <div className="kpi-label">Total Trades</div>
          <div className="kpi-value">{filtered.length}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Realized P&L</div>
          <div className={`kpi-value ${totalRealized>=0?'positive':'negative'}`}>₹{totalRealized.toFixed(2)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Total Fees Paid</div>
          <div className="kpi-value negative">₹{totalFees.toFixed(2)}</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{display:'flex',gap:12,marginBottom:16}}>
        <input className="form-input" placeholder="Filter by symbol..." style={{maxWidth:220}}
          value={filter.symbol} onChange={e=>setFilter(f=>({...f,symbol:e.target.value}))} />
        <div className="tabs" style={{padding:3}}>
          {['All','BUY','SELL'].map(a=>(
            <button key={a} className={`tab-btn${filter.action===a?' active':''}`}
              onClick={()=>setFilter(f=>({...f,action:a}))} style={{padding:'6px 16px',flex:'none'}}>{a}</button>
          ))}
        </div>
      </div>

      <div className="card">
        {filtered.length === 0 ? (
          <div style={{padding:60,textAlign:'center',color:'var(--text-muted)'}}>
            <div style={{fontSize:40,marginBottom:12}}>📊</div>
            No trades found. Start trading in the Simulator!
          </div>
        ) : (
          <div className="table-wrapper" style={{border:'none',borderRadius:0}}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th><th>Symbol</th><th>Action</th><th>Qty</th>
                  <th style={{textAlign:'right'}}>Price</th>
                  <th style={{textAlign:'right'}}>Trade Value</th>
                  <th style={{textAlign:'right'}}>Fees</th>
                  <th style={{textAlign:'right'}}>Net Amount</th>
                  <th style={{textAlign:'right'}}>Realized P&L</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t,i)=>(
                  <tr key={t.id||i}>
                    <td style={{fontSize:12,color:'var(--text-muted)',whiteSpace:'nowrap'}}>
                      {t.timestamp?.toDate?.()?.toLocaleDateString?.() || 'Now'}
                    </td>
                    <td style={{fontWeight:700}}>{t.symbol}</td>
                    <td>
                      <span className={`badge ${t.action==='BUY'?'badge-bullish':'badge-bearish'}`}>{t.action}</span>
                    </td>
                    <td>{t.qty}</td>
                    <td style={{textAlign:'right',fontFamily:'monospace'}}>₹{t.priceAtExecution?.toFixed(2)}</td>
                    <td style={{textAlign:'right',fontFamily:'monospace'}}>₹{t.totalValue?.toFixed(2)}</td>
                    <td style={{textAlign:'right',fontFamily:'monospace',color:'var(--red)'}}>₹{t.transactionFee?.toFixed(2)}</td>
                    <td style={{textAlign:'right',fontFamily:'monospace'}}>₹{t.netAmount?.toFixed(2)}</td>
                    <td style={{textAlign:'right',fontWeight:700}} className={t.realizedPnL>0?'positive':t.realizedPnL<0?'negative':'neutral'}>
                      {t.action==='SELL'?`₹${t.realizedPnL?.toFixed(2)}`:'—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
