<div align="center">

# 📈 Growww — Virtual Trading Simulator

### A real-time, enterprise-grade financial analytics dashboard built with React & Firebase

[![Live Demo](https://img.shields.io/badge/🚀_Live_Demo-groww--9ac05.web.app-6c63ff?style=for-the-badge)](https://groww-9ac05.web.app)
[![Firebase](https://img.shields.io/badge/Firebase-Hosting-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)

</div>

---

## 🧭 Overview

**Growww** is a risk-free, highly realistic virtual trading simulator and analytics dashboard. Users can execute simulated trades across **Equities, Cryptocurrencies, and Bonds**, track real-time portfolio performance, and analyze market trends — all within an enterprise-grade, zero-latency UI.

> Built to bridge the gap for new investors who want real market experience without the financial risk.

---

## ✨ Key Features

| Feature | Description |
|---|---|
| 💼 **Portfolio Simulator** | Execute BUY/SELL trades with live price simulation across 50+ assets |
| 📊 **Multi-Asset Charting** | Overlay multiple assets on a normalized Base-100 return chart |
| ⚙️ **Strategy Builder** | Build, backtest, and deploy custom indicator-based trading strategies |
| 📚 **Strategy Library** | Save and manage strategies with real-time Firestore sync |
| 🕵️ **Watchlist** | Track favourite assets with live price ticks |
| 🌗 **Dark / Light Mode** | Seamless theme toggle via CSS variables — zero re-renders |
| ⚡ **Zero-Latency UI** | Optimistic updates — UI responds instantly, Firebase writes in background |

---

## 🛠️ Technology Stack

```
Frontend    →  React 19 + Vite 8 (HMR)
Routing     →  React Router DOM v7
Database    →  Firebase Cloud Firestore (Real-Time NoSQL)
Auth        →  Firebase Authentication (Email/Password + Google)
Hosting     →  Firebase Hosting
Charts      →  Recharts (SVG-based)
Styling     →  Vanilla CSS3 — Semantic Variables + Flexbox/Grid
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│                  CLIENT LAYER                   │
│      React SPA  ·  Context API (Auth, Theme)    │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│                 SERVICE LAYER                   │
│   tradeEngine.js  ·  assetDataSimulator.js      │
│   indicatorEngine.js  ·  strategyBacktester.js  │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│                  DATA LAYER                     │
│        Firebase Firestore  (onSnapshot)         │
│     Single Source of Truth — Real-Time Sync     │
└─────────────────────────────────────────────────┘
```

---

## ⚙️ Core Modules

### 🔁 Real-Time Trading Engine (`tradeEngine.js`)
All trades are processed as **atomic Firestore Batched Writes** to prevent race conditions:
- Validates available `cashBalance` before execution
- Updates account balance, holding document & trade log in a **single transaction**
- Exact cost-basis calculations with weighted average pricing

### 📡 Live Market Simulation (`assetDataSimulator.js`)
- Implements a **pseudo-random walk algorithm** simulating live tick-by-tick volatility
- Covers **50+ predefined assets** across Stocks, Crypto, and Bonds
- No external API dependency — zero rate limits, zero cost

### ⚡ Zero-Latency Optimistic UI
- UI state updates **before** the Firebase write completes
- All event handlers use **fire-and-forget async promises**
- Eliminates loading spinners on trade execution entirely

### 📈 Advanced Analytics
- **Pie Chart** — live asset allocation by market value
- **Normalized Line Chart** — Base-100 returns for fair multi-asset comparison
- **Correlation Matrix** — Pearson correlation between all selected assets

---

## 🎨 UI/UX Design System

- **Semantic CSS Variables** — `--bg-surface`, `--text-primary`, `--brand` etc. enabling instant Dark/Light switching
- **Glassmorphism** — `backdrop-filter: blur()` with layered box-shadows
- **Responsive Layouts** — CSS Grid + Flexbox adapts across desktop, tablet, and mobile

---

## 🚧 Challenges & Solutions

### 🔴 Challenge 1 — Silent database failures for older accounts
Older user accounts were missing required Firestore documents, causing silent write errors.

**✅ Solution:** Replaced `batch.update()` with `batch.set({ merge: true })` across all write operations in `firestoreService.js`. The system now **self-heals** — documents are initialized on-the-fly if they don't exist.

---

### 🔴 Challenge 2 — UI latency during database updates
Synchronous `await` calls on button clicks were blocking the UI thread, causing noticeable lag.

**✅ Solution:** Refactored all event handlers (Save Chart, Save Strategy, Execute Trade) to **fire-and-forget async promises** — the UI updates instantly and Firebase writes happen in the background.

---

### 🔴 Challenge 3 — Hard page reloads during profile/strategy updates
After saving, the app required a full re-fetch to reflect changes, causing a jarring UX.

**✅ Solution:** Implemented **real-time `onSnapshot` subscriptions** for user profile and strategy library. Updates now propagate **instantly to the React DOM** without any page reload or manual re-fetch.

---

## 🚀 Future Enhancements

- [ ] **Algorithmic Backtester** — Run Moving Average Crossover & RSI strategies on historical data
- [ ] **Social Leaderboard** — View and copy-trade top virtual portfolios
- [ ] **FCM Push Notifications** — Price alerts via Firebase Cloud Messaging
- [ ] **Portfolio Export** — Download trade history as CSV/PDF

---

## 🧑‍💻 Getting Started

```bash
# Clone the repository
git clone https://github.com/Kar93122/Growww.git
cd Growww

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Deploy to Firebase
firebase deploy --only hosting
```

---

<div align="center">

Made with ❤️ using **React** · **Firebase** · **Vite**

[![GitHub](https://img.shields.io/badge/GitHub-Kar93122/Growww-181717?style=flat-square&logo=github)](https://github.com/Kar93122/Growww)
[![Live](https://img.shields.io/badge/Live-groww--9ac05.web.app-6c63ff?style=flat-square)](https://groww-9ac05.web.app)

</div>
