import {
  doc, setDoc, getDoc, updateDoc, deleteDoc,
  collection, addDoc, getDocs, query, orderBy, limit,
  onSnapshot, writeBatch, serverTimestamp, where,
} from 'firebase/firestore';
import { db } from './config';

// ─── Helper: fire-and-forget wrapper ─────────────────────────────────────────
// Runs a promise in the background without blocking the UI thread.
const fireAndForget = (promise) => { promise.catch(console.error); };

// ─── User Profile ────────────────────────────────────────────────────────────
// Self-healing: setDoc with merge:true creates the doc if missing, or merges if it exists.
// No need to check snap.exists() — eliminates silent failures for older accounts.
export const initUserDoc = async (uid, profile) => {
  await setDoc(doc(db, 'users', uid), {
    ...profile,
    createdAt: serverTimestamp(),
    theme: 'dark',
  }, { merge: true });
  await initSimulatorAccount(uid);
};

export const getUserProfile = (uid) => getDoc(doc(db, 'users', uid));

export const subscribeUserProfile = (uid, callback) =>
  onSnapshot(doc(db, 'users', uid), (snap) => {
    if (snap.exists()) callback(snap.data());
  });

export const updateUserProfile = (uid, data) =>
  setDoc(doc(db, 'users', uid), data, { merge: true });

// ─── Preferences ─────────────────────────────────────────────────────────────
export const getPreferences = (uid) =>
  getDoc(doc(db, 'users', uid, 'settings', 'preferences'));

export const updatePreferences = (uid, prefs) =>
  setDoc(doc(db, 'users', uid, 'settings', 'preferences'), prefs, { merge: true });

// ─── Watchlist ────────────────────────────────────────────────────────────────
export const addToWatchlist = (uid, symbol) =>
  setDoc(doc(db, 'users', uid, 'watchlist', symbol), {
    symbol, addedAt: serverTimestamp(),
  });

export const removeFromWatchlist = (uid, symbol) =>
  deleteDoc(doc(db, 'users', uid, 'watchlist', symbol));

export const subscribeWatchlist = (uid, callback) =>
  onSnapshot(collection(db, 'users', uid, 'watchlist'), (snap) =>
    callback(snap.docs.map((d) => d.data()))
  );

// ─── Chart Settings ───────────────────────────────────────────────────────────
export const saveChartSettings = (uid, symbol, settings) =>
  setDoc(doc(db, 'users', uid, 'chartSettings', symbol), settings, { merge: true });

export const getChartSettings = (uid, symbol) =>
  getDoc(doc(db, 'users', uid, 'chartSettings', symbol));

// ─── Multi-Asset Charts ───────────────────────────────────────────────────────
export const saveMultiAssetChart = (uid, chartId, config) =>
  setDoc(doc(db, 'users', uid, 'multiAssetCharts', chartId), {
    ...config, updatedAt: serverTimestamp(),
  }, { merge: true });

export const getMultiAssetCharts = (uid) =>
  getDocs(collection(db, 'users', uid, 'multiAssetCharts'));

export const deleteMultiAssetChart = (uid, chartId) =>
  deleteDoc(doc(db, 'users', uid, 'multiAssetCharts', chartId));

// ─── Pattern Preferences ──────────────────────────────────────────────────────
export const getPatternPreferences = (uid) =>
  getDoc(doc(db, 'users', uid, 'settings', 'patternPreferences'));

export const savePatternPreferences = (uid, prefs) =>
  setDoc(doc(db, 'users', uid, 'settings', 'patternPreferences'), prefs, { merge: true });

// ─── Simulator Account ────────────────────────────────────────────────────────
const INITIAL_CAPITAL = 1000000; // ₹10,00,000

export const initSimulatorAccount = async (uid) => {
  const ref = doc(db, 'users', uid, 'simulator', 'account');
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      cashBalance: INITIAL_CAPITAL,
      initialCapital: INITIAL_CAPITAL,
      totalDeposited: INITIAL_CAPITAL,
      createdAt: serverTimestamp(),
    });
  }
};

export const subscribeSimulatorAccount = (uid, callback) =>
  onSnapshot(doc(db, 'users', uid, 'simulator', 'account'), (snap) =>
    snap.exists() && callback(snap.data())
  );

export const subscribeHoldings = (uid, callback) =>
  onSnapshot(collection(db, 'users', uid, 'simulator', 'holdings', 'items'), (snap) =>
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  );

export const subscribeTradeHistory = (uid, callback) =>
  onSnapshot(
    query(collection(db, 'users', uid, 'simulator', 'trades', 'log'), orderBy('timestamp', 'desc')),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  );

export const executeTradeTransaction = async (uid, trade, holdingUpdate, newCashBalance) => {
  const batch = writeBatch(db);
  batch.set(doc(db, 'users', uid, 'simulator', 'account'), {
    cashBalance: newCashBalance,
    initialCapital: 1000000,
  }, { merge: true });
  const holdingRef = doc(db, 'users', uid, 'simulator', 'holdings', 'items', trade.symbol);
  if (holdingUpdate === null) {
    batch.delete(holdingRef);
  } else {
    batch.set(holdingRef, holdingUpdate, { merge: true });
  }
  const tradeRef = doc(collection(db, 'users', uid, 'simulator', 'trades', 'log'));
  batch.set(tradeRef, { ...trade, timestamp: new Date() });
  await batch.commit();
};

export const resetSimulator = async (uid) => {
  const batch = writeBatch(db);
  batch.set(doc(db, 'users', uid, 'simulator', 'account'), {
    cashBalance: INITIAL_CAPITAL,
    initialCapital: INITIAL_CAPITAL,
    totalDeposited: INITIAL_CAPITAL,
    createdAt: serverTimestamp(),
  });
  const holdingsSnap = await getDocs(
    collection(db, 'users', uid, 'simulator', 'holdings', 'items')
  );
  holdingsSnap.docs.forEach((d) => batch.delete(d.ref));
  const tradesSnap = await getDocs(
    collection(db, 'users', uid, 'simulator', 'trades', 'log')
  );
  tradesSnap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
};

// ─── Strategies ───────────────────────────────────────────────────────────────
export const saveStrategy = (uid, strategy) => {
  const id = strategy.id || Date.now().toString();
  return setDoc(doc(db, 'users', uid, 'strategies', id), {
    ...strategy, id, updatedAt: serverTimestamp(),
  }, { merge: true });
};

export const getStrategies = (uid) =>
  getDocs(query(collection(db, 'users', uid, 'strategies'), orderBy('updatedAt', 'desc')));

// Real-time strategies subscription (replaces one-shot getStrategies for live pages)
export const subscribeStrategies = (uid, callback) =>
  onSnapshot(
    query(collection(db, 'users', uid, 'strategies'), orderBy('updatedAt', 'desc')),
    (snap) => callback(snap.docs.map((d) => d.data()))
  );

export const deleteStrategy = (uid, id) =>
  deleteDoc(doc(db, 'users', uid, 'strategies', id));

// ─── Leaderboard ──────────────────────────────────────────────────────────────
export const publishToLeaderboard = async (uid, displayName) => {
  // Fetch live account + holdings data then write to public leaderboard
  const [accountSnap, holdingsSnap] = await Promise.all([
    getDoc(doc(db, 'users', uid, 'simulator', 'account')),
    getDocs(collection(db, 'users', uid, 'simulator', 'holdings', 'items')),
  ]);
  const account = accountSnap.exists() ? accountSnap.data() : { cashBalance: 1000000, initialCapital: 1000000 };
  const holdings = holdingsSnap.docs.map(d => d.data());
  const holdingValue = holdings.reduce((sum, h) => sum + (h.qty * h.avgCostBasis), 0);
  const totalValue = account.cashBalance + holdingValue;
  const totalReturn = parseFloat((((totalValue - account.initialCapital) / account.initialCapital) * 100).toFixed(2));

  return setDoc(doc(db, 'leaderboard', uid), {
    uid,
    displayName,
    cashBalance: account.cashBalance,
    totalValue,
    totalReturn,
    holdingCount: holdings.length,
    updatedAt: serverTimestamp(),
  }, { merge: true });
};

export const subscribeLeaderboard = (callback) =>
  onSnapshot(
    query(collection(db, 'leaderboard'), orderBy('totalReturn', 'desc'), limit(50)),
    (snap) => callback(snap.docs.map(d => d.data()))
  );

export const getLeaderboardHoldings = async (uid) => {
  const snap = await getDocs(collection(db, 'users', uid, 'simulator', 'holdings', 'items'));
  return snap.docs.map(d => d.data());
};

export const copyTradePortfolio = async (myUid, sourceUid) => {
  const batch = writeBatch(db);
  // Reset my account to match source holdings
  const [sourceAccount, sourceHoldings, myHoldings, myTrades] = await Promise.all([
    getDoc(doc(db, 'users', sourceUid, 'simulator', 'account')),
    getDocs(collection(db, 'users', sourceUid, 'simulator', 'holdings', 'items')),
    getDocs(collection(db, 'users', myUid, 'simulator', 'holdings', 'items')),
    getDocs(collection(db, 'users', myUid, 'simulator', 'trades', 'log')),
  ]);
  // Clear my existing holdings & trades
  myHoldings.docs.forEach(d => batch.delete(d.ref));
  myTrades.docs.forEach(d => batch.delete(d.ref));
  // Copy source account balance
  const srcAcc = sourceAccount.exists() ? sourceAccount.data() : { cashBalance: 1000000, initialCapital: 1000000 };
  batch.set(doc(db, 'users', myUid, 'simulator', 'account'), {
    cashBalance: srcAcc.cashBalance,
    initialCapital: 1000000,
    totalDeposited: 1000000,
    createdAt: serverTimestamp(),
  });
  // Copy source holdings to my account
  sourceHoldings.docs.forEach(d => {
    const holding = d.data();
    batch.set(doc(db, 'users', myUid, 'simulator', 'holdings', 'items', holding.symbol), holding, { merge: true });
  });
  return batch.commit();
};

// ─── Price Alerts ─────────────────────────────────────────────────────────────
export const addAlert = (uid, alert) =>
  setDoc(doc(collection(db, 'users', uid, 'priceAlerts')), {
    ...alert,
    createdAt: serverTimestamp(),
  });

export const subscribeAlerts = (uid, callback) =>
  onSnapshot(
    query(collection(db, 'users', uid, 'priceAlerts'), orderBy('createdAt', 'desc')),
    (snap) => callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  );

export const deleteAlert = (uid, id) =>
  deleteDoc(doc(db, 'users', uid, 'priceAlerts', id));

