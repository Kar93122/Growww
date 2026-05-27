export const calculateFees = (action, qty, price) => {
  // Set fees to 0 so cash balance reduces exactly by asset price (as requested by user)
  return { brokerage: 0, stt: 0, total: 0 };
};

export const executeBuy = ({ symbol, qty, price, cashBalance, holdings }) => {
  const fees = calculateFees('BUY', qty, price);
  const totalCost = qty * price + fees.total;
  if (isNaN(totalCost) || totalCost > cashBalance) {
    return { error: `Insufficient funds. Need ₹${(totalCost||0).toFixed(2)}, have ₹${(cashBalance||0).toFixed(2)}` };
  }
  const existing = holdings.find(h => h.symbol === symbol);
  const prevQty = existing ? existing.qty : 0;
  const prevInvested = existing ? existing.totalInvested : 0;
  const newQty = prevQty + qty;
  const newInvested = prevInvested + totalCost;
  const newAvgCost = newInvested / newQty;
  const newHolding = {
    symbol,
    qty: newQty,
    avgCostBasis: parseFloat(newAvgCost.toFixed(2)),
    totalInvested: parseFloat(newInvested.toFixed(2)),
  };
  const trade = {
    symbol, action: 'BUY', qty,
    priceAtExecution: price,
    totalValue: parseFloat((qty * price).toFixed(2)),
    transactionFee: fees.total,
    netAmount: parseFloat(totalCost.toFixed(2)),
    realizedPnL: 0,
  };
  return { newHolding, newCashBalance: parseFloat((cashBalance - totalCost).toFixed(2)), trade, error: null };
};

export const executeSell = ({ symbol, qty, price, cashBalance, holdings }) => {
  const holding = holdings.find(h => h.symbol === symbol);
  if (!holding) return { error: 'No holding found for ' + symbol };
  if (qty > holding.qty) return { error: `Cannot sell ${qty} shares, you only hold ${holding.qty}` };
  const fees = calculateFees('SELL', qty, price);
  const saleValue = qty * price - fees.total;
  const costBasis = holding.avgCostBasis * qty;
  const realizedPnL = parseFloat((saleValue - costBasis).toFixed(2));
  const newQty = holding.qty - qty;
  const updatedHolding = newQty === 0 ? null : {
    ...holding,
    qty: newQty,
    totalInvested: parseFloat((holding.avgCostBasis * newQty).toFixed(2)),
  };
  const trade = {
    symbol, action: 'SELL', qty,
    priceAtExecution: price,
    totalValue: parseFloat((qty * price).toFixed(2)),
    transactionFee: fees.total,
    netAmount: parseFloat(saleValue.toFixed(2)),
    realizedPnL,
  };
  return {
    updatedHolding,
    newCashBalance: parseFloat((cashBalance + saleValue).toFixed(2)),
    trade, error: null,
  };
};

export const computePortfolioMetrics = (holdings, currentPrices) => {
  let totalInvested = 0, marketValue = 0;
  const allocationByAsset = [];
  holdings.forEach(h => {
    const price = currentPrices[h.symbol] || h.avgCostBasis;
    const mv = h.qty * price;
    totalInvested += h.totalInvested;
    marketValue += mv;
    allocationByAsset.push({ symbol: h.symbol, value: mv, invested: h.totalInvested });
  });
  const unrealizedPnL = marketValue - totalInvested;
  const unrealizedPnLPct = totalInvested > 0 ? (unrealizedPnL / totalInvested) * 100 : 0;
  return {
    totalInvested: parseFloat(totalInvested.toFixed(2)),
    marketValue: parseFloat(marketValue.toFixed(2)),
    unrealizedPnL: parseFloat(unrealizedPnL.toFixed(2)),
    unrealizedPnLPct: parseFloat(unrealizedPnLPct.toFixed(2)),
    allocationByAsset,
  };
};

export const computeRealizedPnL = (trades) =>
  trades.filter(t => t.action === 'SELL').reduce((sum, t) => sum + (t.realizedPnL || 0), 0);
