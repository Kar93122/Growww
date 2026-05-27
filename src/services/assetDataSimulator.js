// Asset registry with realistic price ranges and volatility profiles
export const AssetRegistry = {
  stocks: [
    { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology', basePrice: 178, volatility: 0.015 },
    { symbol: 'TSLA', name: 'Tesla Inc.', sector: 'Automotive', basePrice: 245, volatility: 0.03 },
    { symbol: 'MSFT', name: 'Microsoft Corp.', sector: 'Technology', basePrice: 415, volatility: 0.012 },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', sector: 'Technology', basePrice: 175, volatility: 0.014 },
    { symbol: 'AMZN', name: 'Amazon.com Inc.', sector: 'Consumer', basePrice: 185, volatility: 0.016 },
    { symbol: 'NFLX', name: 'Netflix Inc.', sector: 'Entertainment', basePrice: 630, volatility: 0.022 },
    { symbol: 'META', name: 'Meta Platforms', sector: 'Technology', basePrice: 510, volatility: 0.018 },
    { symbol: 'NVDA', name: 'NVIDIA Corp.', sector: 'Technology', basePrice: 875, volatility: 0.025 },
    { symbol: 'RELIANCE', name: 'Reliance Industries', sector: 'Energy', basePrice: 2850, volatility: 0.013 },
    { symbol: 'TCS', name: 'Tata Consultancy', sector: 'Technology', basePrice: 3920, volatility: 0.010 },
    { symbol: 'INFY', name: 'Infosys Ltd.', sector: 'Technology', basePrice: 1450, volatility: 0.011 },
    { symbol: 'HDFC', name: 'HDFC Bank', sector: 'Finance', basePrice: 1680, volatility: 0.010 },
  ],
  bonds: [
    { symbol: 'US10Y', name: 'US 10Y Treasury', sector: 'Bond', basePrice: 98.5, volatility: 0.003 },
    { symbol: 'US2Y', name: 'US 2Y Treasury', sector: 'Bond', basePrice: 99.2, volatility: 0.002 },
    { symbol: 'IN10Y', name: 'India 10Y Bond', sector: 'Bond', basePrice: 96.8, volatility: 0.002 },
    { symbol: 'DE10Y', name: 'Germany 10Y Bund', sector: 'Bond', basePrice: 97.1, volatility: 0.002 },
  ],
  crypto: [
    { symbol: 'BTC', name: 'Bitcoin', sector: 'Crypto', basePrice: 67500, volatility: 0.045 },
    { symbol: 'ETH', name: 'Ethereum', sector: 'Crypto', basePrice: 3550, volatility: 0.05 },
    { symbol: 'SOL', name: 'Solana', sector: 'Crypto', basePrice: 185, volatility: 0.06 },
    { symbol: 'BNB', name: 'BNB', sector: 'Crypto', basePrice: 605, volatility: 0.04 },
    { symbol: 'ADA', name: 'Cardano', sector: 'Crypto', basePrice: 0.485, volatility: 0.055 },
  ],
};

export const AllAssets = [
  ...AssetRegistry.stocks.map(a => ({ ...a, assetType: 'stock' })),
  ...AssetRegistry.bonds.map(a => ({ ...a, assetType: 'bond' })),
  ...AssetRegistry.crypto.map(a => ({ ...a, assetType: 'crypto' })),
];

export const getAssetInfo = (symbol) =>
  AllAssets.find(a => a.symbol === symbol) || { symbol, name: symbol, basePrice: 100, volatility: 0.02, assetType: 'stock' };

// Seeded random for reproducible datasets per symbol
const seededRandom = (seed) => {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
};

const symbolSeed = (symbol) =>
  symbol.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);

const timeframeCandles = { '1D': 78, '1W': 120, '1M': 180, '3M': 270, '1Y': 365 };

export const generateInitialDataset = (symbol, timeframe = '1M') => {
  const asset = getAssetInfo(symbol);
  const count = timeframeCandles[timeframe] || 180;
  const rand = seededRandom(symbolSeed(symbol) + count);
  const candles = [];
  let price = asset.basePrice;
  const now = Math.floor(Date.now() / 1000);
  const interval = timeframe === '1D' ? 300 : timeframe === '1W' ? 3600 : 86400;

  for (let i = count; i >= 0; i--) {
    const change = (rand() - 0.48) * asset.volatility * price;
    const open = price;
    price = Math.max(price + change, 0.01);
    const high = Math.max(open, price) + rand() * asset.volatility * price * 0.5;
    const low = Math.min(open, price) - rand() * asset.volatility * price * 0.5;
    const volume = Math.floor(rand() * 1000000 + 100000);
    candles.push({
      time: now - i * interval,
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(Math.max(low, 0.01).toFixed(2)),
      close: parseFloat(price.toFixed(2)),
      volume,
    });
  }
  return candles;
};

export const generateNextTick = (symbol, lastCandle, interval = 60) => {
  const asset = getAssetInfo(symbol);
  const change = (Math.random() - 0.49) * asset.volatility * lastCandle.close;
  const open = lastCandle.close;
  const close = Math.max(open + change, 0.01);
  const high = Math.max(open, close) + Math.random() * asset.volatility * close * 0.3;
  const low = Math.min(open, close) - Math.random() * asset.volatility * close * 0.3;
  return {
    time: lastCandle.time + interval,
    open: parseFloat(open.toFixed(2)),
    high: parseFloat(high.toFixed(2)),
    low: parseFloat(Math.max(low, 0.01).toFixed(2)),
    close: parseFloat(close.toFixed(2)),
    volume: Math.floor(Math.random() * 500000 + 50000),
  };
};

export const generateTickPrice = (symbol, lastPrice) => {
  const asset = getAssetInfo(symbol);
  const change = (Math.random() - 0.49) * asset.volatility * lastPrice;
  return Math.max(parseFloat((lastPrice + change).toFixed(2)), 0.01);
};
