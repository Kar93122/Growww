import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { AllAssets, generateTickPrice, getAssetInfo } from '../services/assetDataSimulator';
import { subscribeAlerts, addAlert, deleteAlert } from '../firebase/firestoreService';

// Request browser notification permission
async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  const result = await Notification.requestPermission();
  return result;
}

// Show a browser notification
function showNotification(title, body) {
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/favicon.ico' });
  }
}

export default function PriceAlerts() {
  const { currentUser } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [prices, setPrices] = useState({});
  const [notifPerm, setNotifPerm] = useState(Notification?.permission || 'default');
  const [symbol, setSymbol] = useState('AAPL');
  const [targetPrice, setTargetPrice] = useState('');
  const [condition, setCondition] = useState('above');
  const [addMsg, setAddMsg] = useState('');
  const triggeredRef = useRef(new Set());

  // Subscribe to user's alerts from Firestore
  useEffect(() => {
    const unsub = subscribeAlerts(currentUser.uid, setAlerts);
    return unsub;
  }, [currentUser.uid]);

  // Live price simulation
  useEffect(() => {
    const init = {};
    AllAssets.forEach(a => { init[a.symbol] = a.basePrice; });
    setPrices(init);
    const interval = setInterval(() => {
      setPrices(prev => {
        const next = { ...prev };
        AllAssets.forEach(a => { next[a.symbol] = generateTickPrice(a.symbol, prev[a.symbol] || a.basePrice); });
        return next;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Check alerts against live prices
  useEffect(() => {
    alerts.forEach(alert => {
      const price = prices[alert.symbol];
      if (!price) return;
      const key = `${alert.id}_${Math.floor(price)}`;
      if (triggeredRef.current.has(key)) return;
      const triggered =
        (alert.condition === 'above' && price >= alert.targetPrice) ||
        (alert.condition === 'below' && price <= alert.targetPrice);
      if (triggered) {
        triggeredRef.current.add(key);
        const dir = alert.condition === 'above' ? '📈 Above' : '📉 Below';
        showNotification(
          `🔔 Price Alert: ${alert.symbol}`,
          `${alert.symbol} is now ${dir} ₹${alert.targetPrice.toFixed(2)}! Current: ₹${price.toFixed(2)}`
        );
      }
    });
  }, [prices, alerts]);

  const handleRequestPermission = async () => {
    const result = await requestNotificationPermission();
    setNotifPerm(result);
  };

  const handleAddAlert = () => {
    const parsed = parseFloat(targetPrice);
    if (isNaN(parsed) || parsed <= 0) { setAddMsg('❌ Enter a valid price.'); return; }
    addAlert(currentUser.uid, { symbol, targetPrice: parsed, condition }).catch(console.error);
    setAddMsg(`✅ Alert set: ${symbol} ${condition} ₹${parsed}`);
    setTargetPrice('');
    setTimeout(() => setAddMsg(''), 3000);
  };

  const handleDelete = (id) => {
    deleteAlert(currentUser.uid, id).catch(console.error);
  };

  const currentPrice = prices[symbol] || getAssetInfo(symbol).basePrice;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>🔔 Price Alerts</h1>
        <p>Set target prices and get instant browser push notifications when your assets hit them.</p>
      </div>

      {/* Notification Permission Banner */}
      {notifPerm !== 'granted' && (
        <div className="card card-body" style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--brand)66', background: 'var(--brand)11' }}>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>🔔 Enable Push Notifications</div>
            <div style={{ fontSize: 13, color: 'var(--t-2)' }}>
              {notifPerm === 'denied'
                ? '❌ Notifications are blocked. Please enable them in your browser settings.'
                : 'Allow notifications to receive real-time price alerts in your browser.'}
            </div>
          </div>
          {notifPerm !== 'denied' && (
            <button className="btn btn-primary btn-sm" onClick={handleRequestPermission}>
              Enable Notifications
            </button>
          )}
        </div>
      )}

      {notifPerm === 'granted' && (
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'var(--green)', fontSize: 14 }}>●</span>
          <span style={{ fontSize: 13, color: 'var(--t-2)' }}>Push notifications are active — you'll be alerted even when this tab is in the background.</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20, alignItems: 'start' }}>
        {/* Add Alert Panel */}
        <div className="card card-body">
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>➕ Add New Alert</div>

          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label">Asset</label>
            <select className="form-input form-select" value={symbol} onChange={e => setSymbol(e.target.value)}>
              <optgroup label="Stocks">
                {AllAssets.filter(a => a.assetType === 'stock').map(a => (
                  <option key={a.symbol} value={a.symbol}>📈 {a.symbol} — {a.name}</option>
                ))}
              </optgroup>
              <optgroup label="Crypto">
                {AllAssets.filter(a => a.assetType === 'crypto').map(a => (
                  <option key={a.symbol} value={a.symbol}>🪙 {a.symbol} — {a.name}</option>
                ))}
              </optgroup>
              <optgroup label="Bonds">
                {AllAssets.filter(a => a.assetType === 'bond').map(a => (
                  <option key={a.symbol} value={a.symbol}>🏛️ {a.symbol} — {a.name}</option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Live Price */}
          <div style={{ background: 'var(--bg-surface)', borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--t-3)', marginBottom: 4 }}>LIVE PRICE</div>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'monospace' }}>
              ₹{currentPrice >= 1000 ? currentPrice.toFixed(0) : currentPrice.toFixed(2)}
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label">Alert Condition</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[['above', '📈 Price Goes Above'], ['below', '📉 Price Goes Below']].map(([val, label]) => (
                <button
                  key={val}
                  className={`btn btn-sm ${condition === val ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ flex: 1, fontSize: 12 }}
                  onClick={() => setCondition(val)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">Target Price (₹)</label>
            <input
              className="form-input"
              type="number"
              value={targetPrice}
              onChange={e => setTargetPrice(e.target.value)}
              placeholder={`e.g. ${Math.round(currentPrice * (condition === 'above' ? 1.05 : 0.95))}`}
            />
          </div>

          <button className="btn btn-primary w-full" onClick={handleAddAlert}>
            🔔 Set Alert
          </button>
          {addMsg && (
            <div style={{ marginTop: 10, fontSize: 13, color: addMsg.includes('✅') ? 'var(--green)' : 'var(--red)' }}>
              {addMsg}
            </div>
          )}
        </div>

        {/* Active Alerts List */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">🔔 Active Alerts ({alerts.length})</span>
          </div>
          {alerts.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔕</div>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>No alerts set</div>
              <div style={{ fontSize: 13, color: 'var(--t-3)' }}>Add your first price alert to get started.</div>
            </div>
          ) : (
            <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th>Condition</th>
                    <th style={{ textAlign: 'right' }}>Target</th>
                    <th style={{ textAlign: 'right' }}>Current Price</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.map(alert => {
                    const livePrice = prices[alert.symbol] || 0;
                    const isTriggered =
                      (alert.condition === 'above' && livePrice >= alert.targetPrice) ||
                      (alert.condition === 'below' && livePrice <= alert.targetPrice);
                    const progress = alert.condition === 'above'
                      ? Math.min((livePrice / alert.targetPrice) * 100, 100)
                      : Math.min((alert.targetPrice / Math.max(livePrice, 0.01)) * 100, 100);

                    return (
                      <tr key={alert.id}>
                        <td>
                          <div style={{ fontWeight: 700 }}>{alert.symbol}</div>
                          <div style={{ fontSize: 11, color: 'var(--t-3)' }}>{getAssetInfo(alert.symbol).name}</div>
                        </td>
                        <td>
                          <span style={{ fontSize: 12 }}>
                            {alert.condition === 'above' ? '📈 Above' : '📉 Below'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>
                          ₹{alert.targetPrice >= 1000 ? alert.targetPrice.toFixed(0) : alert.targetPrice.toFixed(2)}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                          ₹{livePrice >= 1000 ? livePrice.toFixed(0) : livePrice.toFixed(2)}
                        </td>
                        <td>
                          {isTriggered ? (
                            <span style={{ color: 'var(--green)', fontWeight: 700, fontSize: 12 }}>✅ Triggered!</span>
                          ) : (
                            <div>
                              <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, width: 80, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${progress}%`, background: 'var(--brand)', borderRadius: 2, transition: 'width 0.5s' }} />
                              </div>
                              <div style={{ fontSize: 10, color: 'var(--t-3)', marginTop: 2 }}>{progress.toFixed(0)}% of target</div>
                            </div>
                          )}
                        </td>
                        <td>
                          <button className="btn btn-ghost btn-xs" style={{ color: 'var(--red)' }} onClick={() => handleDelete(alert.id)}>
                            🗑 Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
