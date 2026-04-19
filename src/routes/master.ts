import { Router, Request, Response } from 'express';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { authMiddleware } from '../middleware/auth';
import { cache } from '../services/cache';
import { supabase } from '../services/supabase';
import {
  fetchBTCCandles, fetchCurrentBTCPrice, getSignal,
  computePnL, TIER_CONFIG
} from '../lib/strategy';

const router = Router();

// GET /master-agent/signal — live 1-min BTC BB signal (30s cache)
router.get('/signal', asyncHandler(async (req: Request, res: Response) => {
  const cached = cache.get<any>('master:signal');
  if (cached) { res.json({ success: true, data: { ...cached, cached: true } }); return; }

  const candles = await fetchBTCCandles(60);
  const signal = getSignal(candles);

  const data = {
    signal: signal.signal,
    direction: signal.direction,
    grade: signal.grade,
    confidence: signal.confidence,
    bandPos: Number(signal.bandPos.toFixed(4)),
    btcPrice: Number(signal.btcPrice.toFixed(2)),
    upper: Number(signal.upper.toFixed(2)),
    lower: Number(signal.lower.toFixed(2)),
    mean: Number(signal.mean.toFixed(2)),
    recentPrices: candles.slice(-5).map(c => ({ ts: c.ts, close: c.close })),
    ts: new Date().toISOString(),
  };

  cache.set('master:signal', data, 30);
  res.json({ success: true, data });
}));

// GET /master-agent/tiers — leverage and R/R for each tier
router.get('/tiers', asyncHandler(async (req: Request, res: Response) => {
  const currentBTC = await fetchCurrentBTCPrice();
  const tiers = Object.entries(TIER_CONFIG).map(([tier, cfg]) => {
    const exampleSize = tier === 'low' ? 1 : tier === 'medium' ? 5 : tier === 'high' ? 25 : 100;
    const position = exampleSize * cfg.leverage;
    const tpWin = position * cfg.tp_pct - exampleSize * 0.002;
    const slLoss = position * cfg.sl_pct + exampleSize * 0.002;
    return {
      tier,
      label: cfg.label,
      leverage: cfg.leverage,
      tp_pct: (cfg.tp_pct * 100).toFixed(1),
      sl_pct: (cfg.sl_pct * 100).toFixed(1),
      rr: (cfg.tp_pct / cfg.sl_pct).toFixed(1),
      exampleSize,
      maxWin: Number(tpWin.toFixed(2)),
      maxLoss: Number(slLoss.toFixed(2)),
    };
  });
  res.json({ success: true, data: { tiers, btcPrice: currentBTC } });
}));

// Maximum trade duration: 1 hour (in seconds)
const MAX_TRADE_DURATION_SEC = 3600;
// Minimum trade duration: 1 second (prevent instant abuse)
const MIN_TRADE_DURATION_SEC = 1;

// POST /master-agent/enter — lock in trade entry at current BTC price
router.post('/enter', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const walletAddress = req.walletAddress!;
  const { tier = 'medium' } = req.body;

  // One active trade per wallet
  const existingKey = `trade:active:${walletAddress}`;
  if (cache.get(existingKey)) {
    throw new AppError(409, 'Trade already active — resolve first');
  }

  const candles = await fetchBTCCandles(60);
  const signal = getSignal(candles);

  if (signal.signal === 'HOLD' || !signal.direction) {
    res.json({ success: true, data: {
      signal: 'HOLD',
      outcome: 'no_signal',
      message: '// no signal — market in range. try again shortly.',
      btcPrice: signal.btcPrice,
    }});
    return;
  }

  const sessionId = `${walletAddress}-${Date.now()}`;
  const tradeData = {
    sessionId,
    walletAddress,
    tier,
    direction: signal.direction,
    entryPrice: signal.btcPrice,
    signal: signal.signal,
    grade: signal.grade,
    confidence: signal.confidence,
    bandPos: signal.bandPos,
    enteredAt: Date.now(),
    maxDurationSec: MAX_TRADE_DURATION_SEC,
  };

  // Store for max duration (1 hour)
  cache.set(existingKey, tradeData, MAX_TRADE_DURATION_SEC);
  cache.set(`trade:session:${sessionId}`, tradeData, MAX_TRADE_DURATION_SEC);

  res.json({ success: true, data: {
    sessionId,
    signal: signal.signal,
    direction: signal.direction,
    grade: signal.grade,
    confidence: signal.confidence,
    entryPrice: signal.btcPrice,
    tier,
    leverage: TIER_CONFIG[tier]?.leverage ?? 15,
    tp_pct: TIER_CONFIG[tier]?.tp_pct ?? 0.012,
    sl_pct: TIER_CONFIG[tier]?.sl_pct ?? 0.006,
    maxDurationSec: MAX_TRADE_DURATION_SEC,
    message: `// ${signal.signal === 'FADE' ? 'SHORT' : 'LONG'} entered at $${signal.btcPrice.toFixed(2)} — close anytime within ${MAX_TRADE_DURATION_SEC/60} minutes`,
    ts: new Date().toISOString(),
  }});
}));

// GET /master-agent/pnl — get live P&L for active trade without closing
router.get('/pnl', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const walletAddress = req.walletAddress!;

  const existingKey = `trade:active:${walletAddress}`;
  const trade = cache.get<any>(existingKey);

  if (!trade || trade.walletAddress !== walletAddress) {
    throw new AppError(404, 'No active trade found');
  }

  const elapsed = (Date.now() - trade.enteredAt) / 1000;
  const remaining = Math.max(0, trade.maxDurationSec - elapsed);

  // Get current BTC price for live P&L
  const currentBTCPrice = await fetchCurrentBTCPrice();

  // Compute current P&L (not final until closed)
  const tierKey = trade.tier ?? 'medium';
  const tradeSize = tierKey === 'low' ? 1 : tierKey === 'medium' ? 5 : tierKey === 'high' ? 25 : 100;

  const result = computePnL(trade.entryPrice, currentBTCPrice, trade.direction, tradeSize, tierKey);

  // Check if TP or SL would be hit
  const profitPct = result.btcChangePct * (trade.direction === 'LONG' ? 1 : -1);
  const tpPct = TIER_CONFIG[tierKey]?.tp_pct ?? 0.012;
  const slPct = TIER_CONFIG[tierKey]?.sl_pct ?? 0.006;

  let autoCloseReason: string | null = null;
  if (profitPct >= tpPct) {
    autoCloseReason = 'take_profit';
  } else if (profitPct <= -slPct) {
    autoCloseReason = 'stop_loss';
  } else if (remaining <= 0) {
    autoCloseReason = 'max_duration';
  }

  res.json({ success: true, data: {
    sessionId: trade.sessionId,
    signal: trade.signal,
    grade: trade.grade,
    direction: trade.direction,
    entryPrice: Number(trade.entryPrice.toFixed(2)),
    currentBTCPrice: Number(currentBTCPrice.toFixed(2)),
    btcChangePct: Number((result.btcChangePct * 100).toFixed(3)),
    leverage: result.leverage,
    positionUsd: Number(result.positionUsd.toFixed(2)),
    grossPnl: Number(result.grossPnl.toFixed(4)),
    fees: Number(result.fees.toFixed(4)),
    netPnl: Number(result.netPnl.toFixed(4)),
    profitable: result.netPnl > 0,
    tradeDurationSec: Math.round(elapsed),
    remainingSec: Math.round(remaining),
    maxDurationSec: trade.maxDurationSec,
    canClose: elapsed >= MIN_TRADE_DURATION_SEC,
    minDurationSec: MIN_TRADE_DURATION_SEC,
    autoCloseReason,  // null if no auto-close triggered, otherwise reason
    tpPct: (tpPct * 100).toFixed(1),
    slPct: (slPct * 100).toFixed(1),
    ts: new Date().toISOString(),
  }});
}));

// POST /master-agent/resolve — close trade, compute real P&L from actual BTC move
router.post('/resolve', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const walletAddress = req.walletAddress!;
  const { sessionId, force = false } = req.body;

  const existingKey = `trade:active:${walletAddress}`;
  const trade = cache.get<any>(existingKey) ?? cache.get<any>(`trade:session:${sessionId}`);

  if (!trade || trade.walletAddress !== walletAddress) {
    throw new AppError(404, 'No active trade found — may have expired (max 1 hour)');
  }

  const elapsed = (Date.now() - trade.enteredAt) / 1000;

  // Check minimum duration (only 1 second now)
  if (!force && elapsed < MIN_TRADE_DURATION_SEC) {
    throw new AppError(429, `Wait ${Math.ceil(MIN_TRADE_DURATION_SEC - elapsed)}s before closing`);
  }

  // Check maximum duration (auto-close allowed)
  if (elapsed > trade.maxDurationSec) {
    console.log(`[Trade] Auto-closing expired trade for ${walletAddress}`);
  }

  // Get REAL current BTC price
  const exitPrice = await fetchCurrentBTCPrice();

  // Compute tier-adjusted P&L
  const tierKey = trade.tier ?? 'medium';
  const tradeSize = tierKey === 'low' ? 1 : tierKey === 'medium' ? 5 : tierKey === 'high' ? 25 : 100;

  const result = computePnL(trade.entryPrice, exitPrice, trade.direction, tradeSize, tierKey);
  const profitable = result.netPnl > 0;
  const rewardAmount = profitable ? Number(result.netPnl.toFixed(4)) : 0;
  const lossAmount = !profitable ? Number(Math.abs(result.netPnl).toFixed(4)) : 0;

  // Credit or debit balance with ledger entry
  const tradeMetadata = {
    sessionId,
    direction: trade.direction,
    entryPrice: trade.entryPrice,
    exitPrice,
    leverage: result.leverage,
    tier: tierKey,
    grade: trade.grade,
    tradeDurationSec: Math.round(elapsed),
    note: profitable 
      ? `Trade profit: ${trade.direction} at ${result.leverage}x leverage, grade ${trade.grade}`
      : `Trade loss: ${trade.direction} at ${result.leverage}x leverage, grade ${trade.grade}`
  };
  
  if (profitable) {
    await supabase.creditBalance(walletAddress, rewardAmount, 'extraction', tradeMetadata);
  } else if (lossAmount > 0) {
    // Deduct loss from balance (real risk)
    await supabase.creditBalance(walletAddress, -lossAmount, 'extraction', tradeMetadata);
  }

  cache.delete(existingKey);
  cache.delete(`trade:session:${sessionId}`);
  cache.delete(`balance:${walletAddress}`);

  // Per-window cooldown (5 minutes before next trade)
  const windowKey = `master:extracted:${walletAddress}:${Math.floor(Date.now() / 300000)}`;
  cache.set(windowKey, true, 360);

  res.json({ success: true, data: {
    sessionId,
    signal: trade.signal,
    grade: trade.grade,
    direction: trade.direction,
    entryPrice: Number(trade.entryPrice.toFixed(2)),
    exitPrice: Number(exitPrice.toFixed(2)),
    btcChangePct: Number((result.btcChangePct * 100).toFixed(3)),
    leverage: result.leverage,
    positionUsd: Number(result.positionUsd.toFixed(2)),
    grossPnl: Number(result.grossPnl.toFixed(4)),
    fees: Number(result.fees.toFixed(4)),
    netPnl: Number(result.netPnl.toFixed(4)),
    outcome: result.outcome,
    profitable,
    rewardAmount,
    lossAmount,
    tradeDurationSec: Math.round(elapsed),
    ts: new Date().toISOString(),
  }});
}));

export default router;
