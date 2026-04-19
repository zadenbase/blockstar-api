// BB Mean Reversion on real 1-min BTC/USD data from Coinbase
// Leverage tied to agent risk tier — forward-looking P&L

const BB_PERIOD = 20;
const BB_STD = 2.0;
const ENTRY_THRESHOLD = 0.82;  // Lower than before = ~8-12 signals/hour

export interface BTCCandle {
  ts: number; open: number; high: number;
  low: number; close: number; volume: number;
}

export interface TierConfig {
  leverage: number;
  tp_pct: number;
  sl_pct: number;
  label: string;
}

export const TIER_CONFIG: Record<string, TierConfig> = {
  low:     { leverage: 5,   tp_pct: 0.010, sl_pct: 0.006, label: 'TIER-I' },
  medium:  { leverage: 15,  tp_pct: 0.012, sl_pct: 0.006, label: 'TIER-II' },
  high:    { leverage: 50,  tp_pct: 0.015, sl_pct: 0.006, label: 'TIER-III' },
  extreme: { leverage: 100, tp_pct: 0.018, sl_pct: 0.006, label: 'TIER-IV' },
};

export interface Signal {
  signal: 'FADE' | 'BUY' | 'HOLD';
  direction: 'SHORT' | 'LONG' | null;
  bandPos: number;
  confidence: number;
  btcPrice: number;
  upper: number;
  lower: number;
  mean: number;
  grade: 'A+' | 'B' | null;
}

export interface TradeResult {
  entryPrice: number;
  exitPrice: number;
  direction: 'SHORT' | 'LONG';
  btcChangePct: number;
  positionUsd: number;
  grossPnl: number;
  fees: number;
  netPnl: number;
  outcome: 'tp' | 'sl' | 'market';
  leverage: number;
}

export async function fetchBTCCandles(limit = 100): Promise<BTCCandle[]> {
  const res = await fetch(
    `https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=60&limit=${limit}`
  );
  if (!res.ok) throw new Error(`Coinbase error: ${res.status}`);
  const raw = await res.json() as number[][];
  // Coinbase: [ts, low, high, open, close, vol] — newest first
  return raw.reverse().map(([ts, low, high, open, close, volume]) => ({
    ts, low, high, open, close, volume
  }));
}

export async function fetchCurrentBTCPrice(): Promise<number> {
  const res = await fetch('https://api.exchange.coinbase.com/products/BTC-USD/ticker');
  if (!res.ok) throw new Error('Coinbase ticker error');
  const d = await res.json() as { price: string };
  return parseFloat(d.price);
}

function calcBB(prices: number[]) {
  const slice = prices.slice(-BB_PERIOD);
  const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
  const std = Math.sqrt(slice.reduce((s, p) => s + (p - mean) ** 2, 0) / slice.length);
  const upper = mean + BB_STD * std;
  const lower = mean - BB_STD * std;
  const cur = prices[prices.length - 1];
  const bandPos = std > 0 ? (cur - lower) / (upper - lower) : 0.5;
  return { mean, upper, lower, bandPos };
}

export function getSignal(candles: BTCCandle[]): Signal {
  if (candles.length < BB_PERIOD + 1) {
    const p = candles[candles.length - 1]?.close ?? 0;
    return { signal: 'HOLD', direction: null, bandPos: 0.5, confidence: 50, btcPrice: p, upper: 0, lower: 0, mean: 0, grade: null };
  }
  const prices = candles.map(c => c.close);
  const { mean, upper, lower, bandPos } = calcBB(prices);
  const btcPrice = prices[prices.length - 1];

  let signal: Signal['signal'] = 'HOLD';
  let direction: Signal['direction'] = null;
  let grade: Signal['grade'] = null;

  if (bandPos >= ENTRY_THRESHOLD) {
    signal = 'FADE'; direction = 'SHORT';
    grade = bandPos >= 0.93 ? 'A+' : 'B';
  } else if (bandPos <= (1 - ENTRY_THRESHOLD)) {
    signal = 'BUY'; direction = 'LONG';
    grade = bandPos <= 0.07 ? 'A+' : 'B';
  }

  const confidence = Math.round(Math.min(99, 50 + Math.abs(bandPos - 0.5) * 100));
  return { signal, direction, bandPos, confidence, btcPrice, upper, lower, mean, grade };
}

export function computePnL(
  entryBTC: number,
  exitBTC: number,
  direction: 'SHORT' | 'LONG',
  tradeUsd: number,
  tier: string
): TradeResult {
  const cfg = TIER_CONFIG[tier] ?? TIER_CONFIG.medium;
  const { leverage, tp_pct, sl_pct } = cfg;

  const positionUsd = tradeUsd * leverage;
  const btcChangePct = (exitBTC - entryBTC) / entryBTC;

  // P&L: LONG profits when BTC goes up, SHORT profits when BTC goes down
  const dirMultiplier = direction === 'LONG' ? 1 : -1;
  const grossPnl = positionUsd * btcChangePct * dirMultiplier;

  // Check if TP/SL was hit during the trade window
  const profitPct = btcChangePct * dirMultiplier;
  let outcome: TradeResult['outcome'] = 'market';
  let finalGross = grossPnl;

  if (profitPct >= tp_pct) {
    // TP hit — cap at TP
    outcome = 'tp';
    finalGross = positionUsd * tp_pct;
  } else if (profitPct <= -sl_pct) {
    // SL hit — cap at SL loss
    outcome = 'sl';
    finalGross = -(positionUsd * sl_pct);
  }

  const fees = tradeUsd * 0.001 * 2; // 0.1% entry + exit (Binance standard)
  const netPnl = finalGross - fees;

  return {
    entryPrice: entryBTC,
    exitPrice: exitBTC,
    direction,
    btcChangePct,
    positionUsd,
    grossPnl: finalGross,
    fees,
    netPnl,
    outcome,
    leverage,
  };
}
