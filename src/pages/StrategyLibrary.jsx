import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { subscribeStrategies, deleteStrategy } from '../firebase/firestoreService';

export default function StrategyLibrary() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [strategies, setStrategies] = useState([]);
  const [loading, setLoading] = useState(true);

  // Real-time subscription: auto-updates when strategies are added/deleted
  useEffect(() => {
    const unsub = subscribeStrategies(currentUser.uid, (data) => {
      setStrategies(data);
      setLoading(false);
    });
    return unsub;
  }, [currentUser.uid]);

  const handleDelete = (id) => {
    if (!window.confirm('Delete this strategy?')) return;
    // Fire-and-forget: the onSnapshot listener will auto-remove it from UI
    deleteStrategy(currentUser.uid, id).catch(console.error);
  };

  return (
    <div className="page-container">
      <div className="page-header" style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
        <div>
          <h1>📚 Strategy Library</h1>
          <p>Your saved trading strategies</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={()=>navigate('/strategy')}>⚙️ Build New Strategy</button>
      </div>

      {loading ? (
        <div style={{textAlign:'center',padding:60}}><div className="spinner" style={{margin:'0 auto'}} /></div>
      ) : strategies.length === 0 ? (
        <div className="card" style={{padding:60,textAlign:'center'}}>
          <div style={{fontSize:48,marginBottom:16}}>📊</div>
          <div style={{fontSize:18,fontWeight:700,marginBottom:8}}>No strategies yet</div>
          <div style={{color:'var(--text-secondary)',marginBottom:24}}>Build your first strategy in the Strategy Builder</div>
          <button className="btn btn-primary" onClick={()=>navigate('/strategy')}>Open Strategy Builder</button>
        </div>
      ) : (
        <div className="grid-3">
          {strategies.map(s=>(
            <div key={s.id} className="card" style={{padding:20}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
                <div>
                  <div style={{fontWeight:800,fontSize:15}}>{s.name}</div>
                  {s.description&&<div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>{s.description}</div>}
                </div>
                <button onClick={()=>handleDelete(s.id)} style={{color:'var(--red)',background:'none',fontSize:16,cursor:'pointer',flexShrink:0}}>✕</button>
              </div>

              <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:12}}>
                {(s.indicators||[]).map(ind=>(
                  <span key={ind.id} style={{
                    fontSize:10,padding:'2px 8px',borderRadius:12,
                    background:`${ind.color}22`,color:ind.color,fontWeight:600
                  }}>{ind.type}</span>
                ))}
              </div>

              {s.backtestResults && (
                <div style={{background:'var(--bg-surface)',borderRadius:'var(--radius)',padding:10,marginBottom:12}}>
                  <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:4,fontWeight:600,textTransform:'uppercase',letterSpacing:0.5}}>Last Backtest</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                    {[
                      ['Return',`${s.backtestResults.totalReturn}%`,s.backtestResults.totalReturn>=0],
                      ['Win Rate',`${s.backtestResults.winRate}%`,s.backtestResults.winRate>=50],
                      ['Drawdown',`${s.backtestResults.maxDrawdown}%`,false],
                      ['Trades',s.backtestResults.trades,undefined],
                    ].map(([k,v,up])=>(
                      <div key={k}>
                        <div style={{fontSize:10,color:'var(--text-muted)'}}>{k}</div>
                        <div className={up===undefined?'':(up?'positive':'negative')} style={{fontWeight:700,fontSize:13}}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{display:'flex',gap:8}}>
                <button className="btn btn-primary btn-sm" style={{flex:1}}
                  onClick={()=>navigate('/strategy')}>Load &amp; Edit</button>
                <button className="btn btn-ghost btn-sm" style={{fontSize:16}} title="Duplicate">⧉</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
