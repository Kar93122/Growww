import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmail, signUpWithEmail, signInWithGoogle } from '../firebase/authService';
import { useAuth } from '../context/AuthContext';

/* ── Icons ─────────────────────────────────────────────────────────────────── */
const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="18" height="18">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const EyeIcon = ({ open }) => open ? (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
) : (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

/* ── Helpers ────────────────────────────────────────────────────────────────── */
const getStrength = (pwd) => {
  let s = 0;
  if (pwd.length >= 8) s++;
  if (/[A-Z]/.test(pwd)) s++;
  if (/[0-9]/.test(pwd)) s++;
  if (/[^A-Za-z0-9]/.test(pwd)) s++;
  return s;
};

const FEATURES = [
  { icon: '📊', label: 'Live Market Simulation',   sub: 'Real-time price feeds' },
  { icon: '🤖', label: 'Strategy Backtesting',      sub: 'Test before you invest' },
  { icon: '🕯️', label: '18+ Pattern Detection',    sub: 'AI-powered recognition' },
  { icon: '💼', label: '₹10L Virtual Portfolio',   sub: 'Risk-free paper trading' },
];

const TICKERS = [
  { sym: 'NIFTY',   chg: '+1.24%', up: true  },
  { sym: 'SENSEX',  chg: '+0.88%', up: true  },
  { sym: 'BTC',     chg: '-0.43%', up: false },
  { sym: 'AAPL',    chg: '+2.11%', up: true  },
  { sym: 'TSLA',    chg: '+3.40%', up: true  },
  { sym: 'ETH',     chg: '-1.02%', up: false },
  { sym: 'RELIANCE',chg: '+0.67%', up: true  },
  { sym: 'NVDA',    chg: '+4.88%', up: true  },
];

/* ── Mini animated candlestick chart ─────────────────────────────────────── */
function CandleChart() {
  const candles = [
    { o:40,h:70,l:30,c:60,up:true  },
    { o:60,h:80,l:50,c:75,up:true  },
    { o:75,h:85,l:55,c:58,up:false },
    { o:58,h:72,l:45,c:68,up:true  },
    { o:68,h:90,l:62,c:88,up:true  },
    { o:88,h:95,l:70,c:72,up:false },
    { o:72,h:82,l:60,c:78,up:true  },
    { o:78,h:96,l:74,c:92,up:true  },
    { o:92,h:98,l:78,c:80,up:false },
    { o:80,h:92,l:76,c:89,up:true  },
  ];
  const H = 100; // viewBox height
  const scale = (v) => H - v; // invert

  return (
    <svg
      className="auth-candle-chart"
      viewBox="0 0 220 110"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Grid lines */}
      {[25,50,75].map(y => (
        <line key={y} x1="0" y1={scale(y)} x2="220" y2={scale(y)}
          stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
      ))}
      {/* Trend line */}
      <polyline
        points="11,65 33,42 55,45 77,38 99,20 121,30 143,25 165,15 187,22 209,17"
        fill="none" stroke="rgba(0,230,118,0.3)" strokeWidth="1.5" strokeDasharray="4 2"
        className="auth-trend-line"
      />
      {/* Candles */}
      {candles.map((c, i) => {
        const x = i * 22 + 11;
        const color = c.up ? '#00e676' : '#ff3d57';
        const bodyTop    = scale(Math.max(c.o, c.c));
        const bodyBottom = scale(Math.min(c.o, c.c));
        const bodyH = Math.max(bodyBottom - bodyTop, 2);
        return (
          <g key={i} className="auth-candle" style={{ animationDelay: `${i * 0.08}s` }}>
            {/* Wick */}
            <line x1={x} y1={scale(c.h)} x2={x} y2={scale(c.l)}
              stroke={color} strokeWidth="1.2" opacity="0.7" />
            {/* Body */}
            <rect
              x={x - 4} y={bodyTop} width={8} height={bodyH}
              fill={color} opacity="0.85" rx="1"
            />
          </g>
        );
      })}
    </svg>
  );
}

/* ── Floating orbs ──────────────────────────────────────────────────────────── */
function Orbs() {
  return (
    <div className="auth-orbs" aria-hidden="true">
      <div className="auth-orb auth-orb-1" />
      <div className="auth-orb auth-orb-2" />
      <div className="auth-orb auth-orb-3" />
      <div className="auth-orb auth-orb-4" />
    </div>
  );
}

/* ── Ticker tape ─────────────────────────────────────────────────────────── */
function TickerTape() {
  const items = [...TICKERS, ...TICKERS]; // doubled for seamless loop
  return (
    <div className="auth-ticker-wrap">
      <div className="auth-ticker-track">
        {items.map((t, i) => (
          <span key={i} className={`auth-ticker-item ${t.up ? 'up' : 'down'}`}>
            <span className="auth-ticker-sym">{t.sym}</span>
            <span className="auth-ticker-chg">{t.chg}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   AUTH PAGE
════════════════════════════════════════════════════════════════════════════ */
export default function AuthPage() {
  const { currentUser, loading: authLoading } = useAuth();
  const [tab, setTab]         = useState('login');
  const [name, setName]       = useState('');
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [shake, setShake]     = useState(false);
  const [mounted, setMounted] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (currentUser && !authLoading) navigate('/', { replace: true });
  }, [currentUser, authLoading, navigate]);

  // Staggered mount animation trigger
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 600);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      let user;
      if (tab === 'login') {
        user = await signInWithEmail(email, password);
      } else {
        user = await signUpWithEmail(email, password, name || email.split('@')[0]);
      }
    } catch (err) {
      setError(err.message.replace('Firebase: ', '').replace(/\(auth\/.*?\)/, '').trim());
      setLoading(false);
      triggerShake();
    }
  };

  const handleGoogle = async () => {
    setError(''); setLoading(true);
    try { await signInWithGoogle(); }
    catch (err) { setError(err.message); setLoading(false); triggerShake(); }
  };

  const switchTab = (t) => {
    setTab(t); setError(''); setName(''); setEmail(''); setPassword('');
  };

  const strength = getStrength(password);
  const strengthColors = ['rgba(255,255,255,0.1)', '#ef4444', '#f59e0b', '#22c55e', '#16a34a'];
  const strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong'];

  return (
    <div className={`auth2-root ${mounted ? 'auth-mounted' : ''}`}>

      {/* ══ LEFT PANEL ══════════════════════════════════════════════════════ */}
      <div className="auth2-left">
        <Orbs />

        <div className="auth2-left-inner">
          {/* Logo */}
          <div className="auth2-logo auth-anim-logo">
            <span className="auth2-logo-icon">📈</span>
            <span className="auth2-logo-text">Gr<em>o</em>ww</span>
          </div>

          {/* Mini chart */}
          <div className="auth-chart-wrap auth-anim-chart">
            <div className="auth-chart-label">
              <span>NIFTY 50</span>
              <span className="auth-chart-pct">▲ +1.24%</span>
            </div>
            <CandleChart />
          </div>

          {/* Headline */}
          <div className="auth2-hero auth-anim-hero">
            <h1>
              Trade smarter.<br />
              <span>Learn faster.</span>
            </h1>
            <p>
              A professional trading simulator with real market mechanics —
              built for serious learners.
            </p>
          </div>

          {/* Feature list with stagger */}
          <ul className="auth2-features">
            {FEATURES.map(({ icon, label, sub }, i) => (
              <li
                key={label}
                className="auth2-feature-item auth-anim-feature"
                style={{ animationDelay: `${0.55 + i * 0.1}s` }}
              >
                <span className="auth2-feature-dot">{icon}</span>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--t-0)', fontSize: 13.5 }}>{label}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--t-3)', marginTop: 1 }}>{sub}</div>
                </div>
              </li>
            ))}
          </ul>

          {/* Badges */}
          <div className="auth2-left-footer auth-anim-badges">
            <span className="auth2-badge">✓ 100% Free</span>
            <span className="auth2-badge">✓ No real money</span>
            <span className="auth2-badge">✓ Instant access</span>
          </div>
        </div>

        {/* Ticker tape at bottom of left panel */}
        <TickerTape />
      </div>

      {/* ══ RIGHT PANEL ═════════════════════════════════════════════════════ */}
      <div className="auth2-right">
        <div className={`auth2-card ${shake ? 'auth-shake' : ''}`}>

          {/* Tabs */}
          <div className="auth2-tabs">
            <button
              className={`auth2-tab-btn${tab === 'login' ? ' active' : ''}`}
              onClick={() => switchTab('login')}
            >Sign In</button>
            <button
              className={`auth2-tab-btn${tab === 'register' ? ' active' : ''}`}
              onClick={() => switchTab('register')}
            >Create Account</button>
          </div>

          <p className="auth2-welcome">
            {tab === 'login'
              ? 'Welcome back! Sign in to continue.'
              : "Join thousands of traders. It's free."}
          </p>

          {/* Google */}
          <button className="auth2-google-btn" onClick={handleGoogle} disabled={loading}>
            <GoogleIcon />
            Continue with Google
          </button>

          <div className="auth2-divider"><span>or</span></div>

          {/* Error */}
          {error && (
            <div className="auth2-error auth-error-pop">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {error}
            </div>
          )}

          {/* Form */}
          <form
            className="auth2-form"
            onSubmit={handleSubmit}
            key={tab}               /* remount form on tab switch → fields fade in */
          >
            {tab === 'register' && (
              <div className="auth2-field auth-field-in" style={{ animationDelay: '0s' }}>
                <label>Display Name</label>
                <input
                  type="text" placeholder="Your name"
                  value={name} onChange={e => setName(e.target.value)}
                  autoComplete="name"
                />
              </div>
            )}

            <div className="auth2-field auth-field-in" style={{ animationDelay: tab === 'register' ? '0.05s' : '0s' }}>
              <label>Email Address</label>
              <input
                type="email" placeholder="you@example.com"
                value={email} onChange={e => setEmail(e.target.value)}
                required autoComplete="email"
              />
            </div>

            <div className="auth2-field auth-field-in" style={{ animationDelay: tab === 'register' ? '0.1s' : '0.05s' }}>
              <label>
                Password
                {tab === 'login' && (
                  <button type="button" className="auth2-forgot" tabIndex={-1}>Forgot?</button>
                )}
              </label>
              <div className="auth2-pwd-wrap">
                <input
                  type={showPwd ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password} onChange={e => setPassword(e.target.value)}
                  required minLength={6}
                  autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                />
                <button type="button" className="auth2-eye" onClick={() => setShowPwd(p => !p)}>
                  <EyeIcon open={showPwd} />
                </button>
              </div>

              {tab === 'register' && password.length > 0 && (
                <div className="auth2-strength auth-strength-pop">
                  <div className="auth2-strength-bars">
                    {[1,2,3,4].map(i => (
                      <div
                        key={i}
                        className="auth2-strength-bar"
                        style={{ background: i <= strength ? strengthColors[strength] : 'rgba(255,255,255,0.08)' }}
                      />
                    ))}
                  </div>
                  <span style={{ color: strengthColors[strength] }}>{strengthLabels[strength]}</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              className={`auth2-submit ${loading ? 'auth-submit-loading' : ''}`}
              disabled={loading}
              style={{ animationDelay: tab === 'register' ? '0.15s' : '0.1s' }}
            >
              {loading
                ? <><span className="auth2-spinner" /> Processing…</>
                : tab === 'login' ? 'Sign In →' : 'Create Account →'}
            </button>
          </form>

          <p className="auth2-terms">
            By continuing you agree to our{' '}
            <a href="#">Terms</a> &amp; <a href="#">Privacy Policy</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
