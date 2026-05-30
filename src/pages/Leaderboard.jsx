import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  publishToLeaderboard, subscribeLeaderboard,
  getLeaderboardHoldings, copyTradePortfolio,
} from '../firebase/firestoreService';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function Leaderboard() {
  const { currentUser, userProfile } = useAuth();
  const [board, setBoard] = useState([]);
  const [publishing, setPublishing] = useState(false);
  const [pubMsg, setPubMsg] = useState('');
  const [copying, setCopying] = useState(null);
  const [copyMsg, setCopyMsg] = useState('');
  const [viewProfile, setViewProfile] = useState(null);
  const [viewHoldings, setViewHoldings] = useState([]);
  const [loadingHoldings, setLoadingHoldings] = useState(false);

  useEffect(() => {
    const unsub = subscribeLeaderboard(setBoard);
    return unsub;
  }, []);

  const handlePublish = async () => {
    setPublishing(true);
    setPubMsg('');
    try {
      await publishToLeaderboard(currentUser.uid, userProfile?.displayName || currentUser.email);
      setPubMsg('✅ Your portfolio is now public on the leaderboard!');
    } catch (e) {
      setPubMsg('❌ Failed: ' + e.message);
    }
    setPublishing(false);
    setTimeout(() => setPubMsg(''), 4000);
  };

  const handleViewProfile = async (entry) => {
    setViewProfile(entry);
    setViewHoldings([]);
    setLoadingHoldings(true);
    try {
      const holdings = await getLeaderboardHoldings(entry.uid);
      setViewHoldings(holdings);
    } catch (e) {
      setViewHoldings([]);
    }
    setLoadingHoldings(false);
  };

  const handleCopyTrade = async (entry) => {
    if (!window.confirm(`Copy ${entry.displayName}'s portfolio? This will reset your simulator and mirror their holdings.`)) return;
    setCopying(entry.uid);
    setCopyMsg('');
    try {
      await copyTradePortfolio(currentUser.uid, entry.uid);
      setCopyMsg(`✅ Successfully copied ${entry.displayName}'s portfolio!`);
      setViewProfile(null);
    } catch (e) {
      setCopyMsg('❌ Copy failed: ' + e.message);
    }
    setCopying(null);
    setTimeout(() => setCopyMsg(''), 5000);
  };

  const myEntry = board.find(e => e.uid === currentUser.uid);

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>🏆 Social Leaderboard</h1>
          <p>See top-performing virtual portfolios and copy-trade the best strategies.</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          <button className="btn btn-primary btn-sm" onClick={handlePublish} disabled={publishing}>
            {publishing ? '⏳ Publishing...' : '📡 Publish My Portfolio'}
          </button>
          {pubMsg && <div style={{ fontSize: 12, color: pubMsg.includes('✅') ? 'var(--green)' : 'var(--red)' }}>{pubMsg}</div>}
          {copyMsg && <div style={{ fontSize: 12, color: copyMsg.includes('✅') ? 'var(--green)' : 'var(--red)' }}>{copyMsg}</div>}
        </div>
      </div>

      {/* My Rank Banner */}
      {myEntry && (
        <div className="card card-body" style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, var(--brand)22, var(--bg-2))', border: '1px solid var(--brand)44' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ fontSize: 32 }}>{MEDALS[board.indexOf(myEntry)] || `#${board.indexOf(myEntry) + 1}`}</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16 }}>Your Rank: #{board.indexOf(myEntry) + 1}</div>
              <div style={{ fontSize: 13, color: 'var(--t-2)' }}>Total Return: <span className={myEntry.totalReturn >= 0 ? 'positive' : 'negative'} style={{ fontWeight: 700 }}>{myEntry.totalReturn >= 0 ? '+' : ''}{myEntry.totalReturn}%</span></div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, color: 'var(--t-3)' }}>Portfolio Value</div>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'monospace' }}>₹{(myEntry.totalValue || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
          </div>
        </div>
      )}

      {board.length === 0 ? (
        <div className="card" style={{ padding: '60px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🏁</div>
          <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Leaderboard is empty</div>
          <div style={{ color: 'var(--t-3)', marginBottom: 24 }}>Be the first to publish your portfolio!</div>
          <button className="btn btn-primary" onClick={handlePublish} disabled={publishing}>
            📡 Publish My Portfolio
          </button>
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <span className="card-title">🏆 Top Portfolios</span>
            <span style={{ fontSize: 12, color: 'var(--t-3)' }}>{board.length} traders on the board</span>
          </div>
          <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Trader</th>
                  <th style={{ textAlign: 'right' }}>Portfolio Value</th>
                  <th style={{ textAlign: 'right' }}>Total Return</th>
                  <th style={{ textAlign: 'right' }}>Cash Balance</th>
                  <th style={{ textAlign: 'right' }}>Holdings</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {board.map((entry, i) => {
                  const isMe = entry.uid === currentUser.uid;
                  return (
                    <tr key={entry.uid} style={{ background: isMe ? 'var(--brand)11' : undefined }}>
                      <td>
                        <div style={{ fontSize: 20 }}>{MEDALS[i] || `#${i + 1}`}</div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 36, height: 36, borderRadius: '50%',
                            background: `hsl(${(entry.displayName?.charCodeAt(0) || 65) * 5}, 65%, 50%)`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#fff', fontWeight: 800, fontSize: 14, flexShrink: 0,
                          }}>
                            {(entry.displayName || 'T')[0].toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700 }}>{entry.displayName || 'Anonymous'} {isMe && <span className="badge" style={{ fontSize: 9 }}>YOU</span>}</div>
                            <div style={{ fontSize: 11, color: 'var(--t-3)' }}>
                              Updated {entry.updatedAt ? new Date(entry.updatedAt?.toDate?.() || entry.updatedAt).toLocaleDateString() : 'recently'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>
                        ₹{(entry.totalValue || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span className={entry.totalReturn >= 0 ? 'positive' : 'negative'} style={{ fontWeight: 800 }}>
                          {entry.totalReturn >= 0 ? '+' : ''}{entry.totalReturn}%
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                        ₹{(entry.cashBalance || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </td>
                      <td style={{ textAlign: 'right' }}>{entry.holdingCount || 0}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-ghost btn-xs" onClick={() => handleViewProfile(entry)}>👁 View</button>
                          {!isMe && (
                            <button
                              className="btn btn-primary btn-xs"
                              onClick={() => handleCopyTrade(entry)}
                              disabled={copying === entry.uid}
                            >
                              {copying === entry.uid ? '⏳' : '📋 Copy'}
                            </button>
                          )}
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

      {/* View Profile Modal */}
      {viewProfile && (
        <div className="modal-overlay" onClick={() => setViewProfile(null)}>
          <div className="modal" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">👤 {viewProfile.displayName}'s Portfolio</span>
              <button className="modal-close" onClick={() => setViewProfile(null)}>×</button>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                {[
                  ['Total Return', `${viewProfile.totalReturn >= 0 ? '+' : ''}${viewProfile.totalReturn}%`, viewProfile.totalReturn >= 0],
                  ['Portfolio Value', `₹${(viewProfile.totalValue || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, undefined],
                  ['Cash Balance', `₹${(viewProfile.cashBalance || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, undefined],
                  ['Holdings', viewProfile.holdingCount || 0, undefined],
                ].map(([k, v, up]) => (
                  <div key={k} style={{ background: 'var(--bg-surface)', padding: '10px 14px', borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: 'var(--t-3)', marginBottom: 4 }}>{k}</div>
                    <div className={up === undefined ? '' : up ? 'positive' : 'negative'} style={{ fontWeight: 800, fontSize: 16 }}>{v}</div>
                  </div>
                ))}
              </div>

              <div style={{ fontWeight: 700, marginBottom: 10 }}>📦 Holdings</div>
              {loadingHoldings ? (
                <div style={{ textAlign: 'center', padding: 20 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
              ) : viewHoldings.length === 0 ? (
                <div style={{ color: 'var(--t-3)', fontSize: 13, textAlign: 'center', padding: 16 }}>No holdings data available</div>
              ) : (
                <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                  {viewHoldings.map(h => (
                    <div key={h.symbol} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                      <span style={{ fontWeight: 700 }}>{h.symbol}</span>
                      <span style={{ color: 'var(--t-2)' }}>{h.qty} shares</span>
                      <span style={{ fontFamily: 'monospace' }}>avg ₹{h.avgCostBasis}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {viewProfile.uid !== currentUser.uid && (
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-secondary w-full" onClick={() => setViewProfile(null)}>Close</button>
                <button
                  className="btn btn-primary w-full"
                  onClick={() => handleCopyTrade(viewProfile)}
                  disabled={copying === viewProfile.uid}
                >
                  {copying === viewProfile.uid ? '⏳ Copying...' : '📋 Copy Trade This Portfolio'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
