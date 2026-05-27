import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmail, signUpWithEmail, signInWithGoogle } from '../firebase/authService';

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const getStrength = (pwd) => {
  let score = 0;
  if (pwd.length >= 8) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  return score;
};

export default function AuthPage() {
  const [tab, setTab] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      if (tab === 'login') await signInWithEmail(email, password);
      else await signUpWithEmail(email, password, name || email.split('@')[0]);
      navigate('/');
    } catch (err) {
      setError(err.message.replace('Firebase: ', '').replace(/\(auth\/.*?\)/, '').trim());
    } finally { setLoading(false); }
  };

  const handleGoogle = async () => {
    setError(''); setLoading(true);
    try { await signInWithGoogle(); navigate('/'); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const strength = getStrength(password);
  const strengthColors = ['#ff4757', '#ffd32a', '#ffd32a', '#00d084', '#00d084'];
  const strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong'];

  return (
    <div className="auth-page">
      <div className="auth-bg-orb auth-bg-orb-1" />
      <div className="auth-bg-orb auth-bg-orb-2" />

      <div className="auth-split-left">
        <div className="auth-brand">
          <div className="auth-brand-logo">
            <div className="logo-icon">📈</div>
            Gr<em style={{color:'var(--accent)'}}>o</em>ww
          </div>
        </div>
        <h1 className="auth-headline">
          Trade Smarter.<br />
          <span>Learn Faster.</span>
        </h1>
        <p className="auth-subline">
          A professional-grade trading simulator with real market mechanics,
          pattern recognition, and strategy backtesting — all in one platform.
        </p>
        <div className="auth-features">
          {[
            ['📊', 'Multi-asset charts', 'Overlay stocks, bonds & crypto with real-time simulation'],
            ['🤖', 'Strategy Builder', 'Create rules like "Buy when RSI < 30" and backtest instantly'],
            ['🕯️', 'Pattern Recognition', '18+ candlestick patterns detected automatically'],
            ['💼', 'Paper Trading', 'Trade with ₹10L virtual cash, track P&L in real time'],
          ].map(([icon, title, desc]) => (
            <div className="auth-feature" key={title}>
              <span className="auth-feature-icon">{icon}</span>
              <span><strong>{title}</strong> — {desc}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="auth-split-right">
        <div className="auth-card">
          <div className="auth-tabs">
            <button className={`auth-tab${tab==='login'?' active':''}`} onClick={()=>{setTab('login');setError('');}}>Sign In</button>
            <button className={`auth-tab${tab==='register'?' active':''}`} onClick={()=>{setTab('register');setError('');}}>Create Account</button>
          </div>

          <button className="google-btn" onClick={handleGoogle} disabled={loading}>
            <GoogleIcon />
            Continue with Google
          </button>

          <div className="auth-divider"><span>or continue with email</span></div>

          {error && <div className="error-msg" style={{marginBottom:16}}>{error}</div>}

          <form className="auth-form" onSubmit={handleSubmit}>
            {tab === 'register' && (
              <div className="form-group">
                <label className="form-label">Display Name</label>
                <input className="form-input" placeholder="Your name" value={name}
                  onChange={e=>setName(e.target.value)} />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input className="form-input" type="email" placeholder="you@example.com"
                value={email} onChange={e=>setEmail(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="form-input" type="password" placeholder="••••••••"
                value={password} onChange={e=>setPassword(e.target.value)} required minLength={6} />
              {tab === 'register' && password.length > 0 && (
                <div>
                  <div className="strength-bar">
                    <div className="strength-fill" style={{width:`${strength*25}%`, background: strengthColors[strength]}} />
                  </div>
                  <div style={{fontSize:11,color:strengthColors[strength],marginTop:4}}>{strengthLabels[strength]}</div>
                </div>
              )}
            </div>
            <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
              {loading ? '⏳ Please wait...' : tab === 'login' ? '🚀 Sign In' : '✨ Create Account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
