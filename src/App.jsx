import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import AuthPage from './pages/AuthPage';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import Markets from './pages/Markets';
import Watchlist from './pages/Watchlist';
import StockDetail from './pages/StockDetail';
import Simulator from './pages/Simulator';
import TradeHistory from './pages/TradeHistory';
import MultiAssetChart from './pages/MultiAssetChart';
import StrategyBuilder from './pages/StrategyBuilder';
import StrategyLibrary from './pages/StrategyLibrary';
import Profile from './pages/Profile';
import AlgoSandbox from './pages/AlgoSandbox';
import Leaderboard from './pages/Leaderboard';
import PriceAlerts from './pages/PriceAlerts';
import './index.css';

function AppLayout({ children }) {
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <Navbar />
        {children}
      </div>
    </div>
  );
}

export default function App() {
  return (
    // ThemeProvider wraps everything — sets data-theme on <html>
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/*" element={
              <ProtectedRoute>
                <AppLayout>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/markets" element={<Markets />} />
                    <Route path="/watchlist" element={<Watchlist />} />
                    <Route path="/stock/:symbol" element={<StockDetail />} />
                    <Route path="/simulator" element={<Simulator />} />
                    <Route path="/trades" element={<TradeHistory />} />
                    <Route path="/multi-chart" element={<MultiAssetChart />} />
                    <Route path="/strategy" element={<StrategyBuilder />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/strategy-library" element={<StrategyLibrary />} />
                    <Route path="/algo-sandbox" element={<AlgoSandbox />} />
                    <Route path="/leaderboard" element={<Leaderboard />} />
                    <Route path="/alerts" element={<PriceAlerts />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </AppLayout>
              </ProtectedRoute>
            } />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
