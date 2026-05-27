import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { AllAssets, generateTickPrice, getAssetInfo } from '../services/assetDataSimulator';
import { executeBuy, executeSell, computePortfolioMetrics, calculateFees } from '../services/tradeEngine';
import { subscribeSimulatorAccount, subscribeHoldings, subscribeTradeHistory, executeTradeTransaction, resetSimulator } from '../firebase/firestoreService';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const COLORS = ['#6c63ff','#00d4aa','#ffd32a','#ff4757','#ff9f43','#a29bfe','#fd9644','#26de81','#4bcffa','#fd79a8'];

export default function Simulator() {
  const { currentUser } = useAuth();
  const [account, setAccount] = useState(null);
  const [holdings, setHoldings] = useState([]);
  const [trades, setTrades] = useState([]);
  const [prices, setPrices] = useState({});
  const [prevPrices, setPrevPrices] = useState({});
  const [selectedSymbol, setSelectedSymbol] = useState('AAPL');
  const [action, setAction] = useState('BUY');
  const [qty, setQty] = useState(1);
  const [tradeError, setTradeError] = useState('');
  const [tradeSuccess, setTradeSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null);
  const [resetting, setResetting] = useState(false);

  // Firebase subscriptions
  useEffect(() => {
    const u1 = subscribeSimulatorAccount(currentUser.uid, setAccount);
    const u2 = subscribeHoldings(currentUser.uid, setHoldings);
    const u3 = subscribeTradeHistory(currentUser.uid, t => setTrades(t.slice(0,50)));
    return () => { u1?.(); u2?.(); u3?.(); };
  }, [currentUser.uid]);

  // Live prices
  useEffect(() => {
    const init = {};
    AllAssets.forEach(a => { init[a.symbol] = a.basePrice; });
    // Add holding symbols
    holdings.forEach(h => { if (!init[h.symbol]) init[h.symbol] = getAssetInfo(h.symbol).basePrice; });
    setPrices(p => ({...init,...p}));
    const interval = setInterval(() => {
      setPrevPrices(p => ({...p,...prices}));
      setPrices(prev => {
        const next = {...prev};
        AllAssets.forEach(a => { next[a.symbol] = generateTickPrice(a.symbol, prev[a.symbol]||a.basePrice); });
        return next;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [holdings.length]);

  const currentPrice = prices[selectedSymbol] || getAssetInfo(selectedSymbol).basePrice;
  const fees = calculateFees(action, qty||0, currentPrice);
  const totalCost = qty * currentPrice + (action==='BUY'?fees.total:-fees.total);

  const metrics = computePortfolioMetrics(holdings, prices);
  const totalValue = (account?.cashBalance||0) + metrics.marketValue;
  const totalPnL = totalValue - (account?.initialCapital||1000000);
  const totalPnLPct = ((totalPnL / (account?.initialCapital||1000000)) * 100);

  const allocationData = metrics.allocationByAsset.filter(a=>a.value>0);

  const handleTrade = () => {
    if (qty <= 0) { setTradeError('Quantity must be at least 1'); return; }
    setConfirmModal({ action, symbol: selectedSymbol, qty: parseInt(qty), price: currentPrice, fees });
  };

  const confirmTrade = async () => {
    const { action: act, symbol, qty: q, price } = confirmModal;
    setConfirmModal(null); setLoading(true); setTradeError(''); setTradeSuccess('');
    try {
      let result;
      if (act === 'BUY') {
        result = executeBuy({ symbol, qty:q, price, cashBalance: account.cashBalance, holdings });
      } else {
        result = executeSell({ symbol, qty:q, price, cashBalance: account.cashBalance, holdings });
      }
      if (result.error) { setTradeError(result.error); setLoading(false); return; }
      const trade = result.trade;
      const newHolding = act==='BUY' ? result.newHolding : result.updatedHolding;
      const newCash = act==='BUY' ? result.newCashBalance : result.newCashBalance;
      await executeTradeTransaction(currentUser.uid, trade, newHolding, newCash);
      setTradeSuccess(`${act} ${q} ${symbol} @ ${price.toFixed(2)} executed!`);
      setTimeout(()=>setTradeSuccess(''),4000);
    } catch(e) { setTradeError(e.message); }
    finally { setLoading(false); }
  };

  const handleReset = async () => {
    if (!window.confirm('Reset your entire portfolio? This cannot be undone.')) return;
    setResetting(true);
    await resetSimulator(currentUser.uid);
    setResetting(false);
  };

  const holding = holdings.find(h=>h.symbol===selectedSymbol);
  const selectedPrice = prices[selectedSymbol] || getAssetInfo(selectedSymbol).basePrice;

  return (
    <div className="page-container">
      <div className="page-header" style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
        <div>
          <h1>💼 Portfolio Simulator</h1>
          <p>Paper trading with ₹10,00,000 virtual capital — no real money</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={handleReset} disabled={resetting}>
          {resetting ? '⏳ Resetting...' : '🔄 Reset Portfolio'}
        </button>
      </div>

      {/* Account Summary */}
      <div className="grid-4" style={{marginBottom:24}}>
        {[
          { label:'Cash Balance', value:`₹${(account?.cashBalance||0).toLocaleString('en-IN',{maximumFractionDigits:0})}`, sub:'Available' },
          { label:'Portfolio Value', value:`₹${totalValue.toLocaleString('en-IN',{maximumFractionDigits:0})}`, sub:'Cash + Holdings' },
          { label:'Total P&L', value:`₹${totalPnL.toLocaleString('en-IN',{maximumFractionDigits:0})}`, sub:`${totalPnLPct.toFixed(2)}%`, pnl:true, up:totalPnL>=0 },
          { label:'Holdings', value:holdings.length, sub:'Active positions' },
        ].map(({label,value,sub,pnl,up})=>(
          <div className="kpi-card" key={label}>
            <div className="kpi-label">{label}</div>
            <div className={`kpi-value ${pnl?(up?'positive':'negative'):''}`} style={{fontSize:18}}>{value}</div>
            <div className="kpi-sub">{sub}</div>
          </div>
        ))}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'320px 1fr 300px',gap:20,alignItems:'start'}}>
        {/* Trade Panel */}
        <div className="card card-body">
          <div className="card-title" style={{marginBottom:16}}>Execute Trade</div>

          {tradeError && <div className="error-msg" style={{marginBottom:12,fontSize:12}}>{tradeError}</div>}
          {tradeSuccess && <div className="success-msg" style={{marginBottom:12,fontSize:12}}>{tradeSuccess}</div>}

          <div className="form-group" style={{marginBottom:12}}>
            <label className="form-label">Asset</label>
            <select className="form-input form-select" value={selectedSymbol} onChange={e=>setSelectedSymbol(e.target.value)}>
              {AllAssets.filter(a=>a.assetType==='stock').map(a=>(
                <option key={a.symbol} value={a.symbol}>{a.symbol} — {a.name}</option>
              ))}
            </select>
          </div>

          <div style={{background:'var(--bg-surface)',borderRadius:'var(--radius)',padding:'12px 16px',marginBottom:16}}>
            <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:4}}>LIVE PRICE</div>
            <div style={{fontSize:22,fontWeight:800,fontFamily:'monospace'}}>
              ₹{selectedPrice>=1000?selectedPrice.toFixed(0):selectedPrice.toFixed(2)}
            </div>
            {holding && (
              <div style={{fontSize:11,marginTop:4,color:'var(--text-secondary)'}}>
                You hold: {holding.qty} shares @ avg ₹{holding.avgCostBasis}
              </div>
            )}
          </div>

          <div className="tabs" style={{marginBottom:16}}>
            <button className={`tab-btn${action==='BUY'?' active':''}`} onClick={()=>setAction('BUY')}>BUY</button>
            <button className={`tab-btn${action==='SELL'?' active':''}`} onClick={()=>setAction('SELL')}>SELL</button>
          </div>

          <div className="form-group" style={{marginBottom:12}}>
            <label className="form-label">Quantity</label>
            <input className="form-input" type="number" min={1} value={qty} onChange={e=>setQty(e.target.value)} />
          </div>

          <div style={{background:'var(--bg-surface)',borderRadius:'var(--radius)',padding:12,marginBottom:16,fontSize:12}}>
            {[
              ['Trade Value', `₹${(qty*selectedPrice).toFixed(2)}`],
              ['Brokerage', `₹${fees.brokerage}`],
              ['STT', `₹${fees.stt}`],
              ['Total Fees', `₹${fees.total.toFixed(2)}`],
            ].map(([k,v])=>(
              <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'3px 0',borderBottom:'1px solid var(--border)'}}>
                <span style={{color:'var(--text-muted)'}}>{k}</span><span style={{fontWeight:600}}>{v}</span>
              </div>
            ))}
            <div style={{display:'flex',justifyContent:'space-between',marginTop:8,fontWeight:700,fontSize:13}}>
              <span>Net {action==='BUY'?'Debit':'Credit'}</span>
              <span className={action==='BUY'?'negative':'positive'}>₹{Math.abs(totalCost).toFixed(2)}</span>
            </div>
          </div>

          <button
            className={`btn w-full ${action==='BUY'?'btn-green':'btn-red'}`}
            onClick={handleTrade} disabled={loading}
          >
            {loading?'⏳ Processing...':action==='BUY'?`🟢 BUY ${qty} ${selectedSymbol}`:`🔴 SELL ${qty} ${selectedSymbol}`}
          </button>
        </div>

        {/* Holdings Table */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Holdings</span>
            <span style={{fontSize:12,color:'var(--text-muted)'}}>
              Unrealized P&L: <span className={metrics.unrealizedPnL>=0?'positive':'negative'}>
                ₹{metrics.unrealizedPnL.toLocaleString('en-IN',{maximumFractionDigits:0})} ({metrics.unrealizedPnLPct.toFixed(2)}%)
              </span>
            </span>
          </div>
          {holdings.length === 0 ? (
            <div style={{padding:40,textAlign:'center',color:'var(--text-muted)'}}>
              <div style={{fontSize:32,marginBottom:8}}>📰</div>
              No holdings yet. Execute your first trade!
            </div>
          ) : (
            <div className="table-wrapper" style={{border:'none',borderRadius:0}}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Symbol</th><th>Qty</th><th>Avg Cost</th>
                    <th>Invested</th><th>Market Value</th><th>P&L</th><th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.map(h => {
                    const price = prices[h.symbol] || h.avgCostBasis;
                    const mv = h.qty * price;
                    const pnl = mv - h.totalInvested;
                    const pnlPct = (pnl / h.totalInvested * 100).toFixed(2);
                    const up = pnl >= 0;
                    return (
                      <tr key={h.symbol}>
                        <td><div style={{fontWeight:700}}>{h.symbol}</div><div style={{fontSize:11,color:'var(--text-muted)'}}>{getAssetInfo(h.symbol).name}</div></td>
                        <td>{h.qty}</td>
                        <td className="font-mono">₹{h.avgCostBasis}</td>
                        <td className="font-mono">₹{h.totalInvested.toLocaleString('en-IN',{maximumFractionDigits:0})}</td>
                        <td className="font-mono">₹{mv.toLocaleString('en-IN',{maximumFractionDigits:0})}</td>
                        <td className={up?'positive':'negative'}>
                          <div style={{fontWeight:700}}>{up?'+':''}{pnl.toFixed(0)}</div>
                          <div style={{fontSize:11}}>{up?'+':''}{pnlPct}%</div>
                        </td>
                        <td>
                          <button className="btn btn-red btn-xs" onClick={()=>{
                            setSelectedSymbol(h.symbol); setAction('SELL');
                            setQty(h.qty);
                            window.scrollTo({top:0,behavior:'smooth'});
                          }}>Sell</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Analysis Panel */}
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          <div className="card card-body">
            <div className="card-title" style={{marginBottom:16}}>Asset Allocation</div>
            {allocationData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={allocationData} cx="50%" cy="50%" innerRadius={55} outerRadius={80}
                    dataKey="value" nameKey="symbol" paddingAngle={3}>
                    {allocationData.map((_, i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v)=>`₹${v.toLocaleString('en-IN',{maximumFractionDigits:0})}`} contentStyle={{background:'var(--bg-modal)',border:'1px solid var(--border)',borderRadius:8}} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{fontSize:11}} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{height:200,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text-muted)',fontSize:13}}>No holdings to display</div>
            )}
          </div>

          <div className="card card-body">
            <div className="card-title" style={{marginBottom:12}}>P&L Summary</div>
            {[
              ['Invested', `₹${metrics.totalInvested.toLocaleString('en-IN',{maximumFractionDigits:0})}`],
              ['Market Value', `₹${metrics.marketValue.toLocaleString('en-IN',{maximumFractionDigits:0})}`],
              ['Unrealized', `₹${metrics.unrealizedPnL.toFixed(0)}`, metrics.unrealizedPnL>=0],
              ['Total P&L', `₹${totalPnL.toFixed(0)} (${totalPnLPct.toFixed(2)}%)`, totalPnL>=0],
            ].map(([k,v,up])=>(
              <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid var(--border)',fontSize:13}}>
                <span style={{color:'var(--text-muted)'}}>{k}</span>
                <span className={up===undefined?'':(up?'positive':'negative')} style={{fontWeight:700}}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Confirm Modal */}
      {confirmModal && (
        <div className="modal-overlay" onClick={()=>setConfirmModal(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Confirm {confirmModal.action}</span>
              <button className="modal-close" onClick={()=>setConfirmModal(null)}>×</button>
            </div>
            <div style={{marginBottom:20}}>
              {[['Action',confirmModal.action],['Symbol',confirmModal.symbol],
               ['Quantity',confirmModal.qty],['Price at Execution',`₹${confirmModal.price.toFixed(2)}`],
               ['Total Fees',`₹${confirmModal.fees.total.toFixed(2)}`],
               ['Net Amount',`₹${(confirmModal.qty*confirmModal.price+(confirmModal.action==='BUY'?confirmModal.fees.total:-confirmModal.fees.total)).toFixed(2)}`],
              ].map(([k,v])=>(
                <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid var(--border)',fontSize:14}}>
                  <span style={{color:'var(--text-secondary)'}}>{k}</span><span style={{fontWeight:700}}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{display:'flex',gap:10}}>
              <button className="btn btn-secondary w-full" onClick={()=>setConfirmModal(null)}>Cancel</button>
              <button className={`btn w-full ${confirmModal.action==='BUY'?'btn-green':'btn-red'}`} onClick={confirmTrade}>
                Confirm {confirmModal.action}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
