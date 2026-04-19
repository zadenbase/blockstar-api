import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabase';
import { cache } from '../services/cache';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { authMiddleware } from '../middleware/auth';
import { purchaseLimiter } from '../middleware/rateLimiter';

const router = Router();

// Risk tier → price mapping
const RISK_PRICE: Record<string, number> = {
  low: 1, medium: 5, high: 25, extreme: 100,
};

// POST /purchases — deducts from internal balance (no on-chain tx required)
router.post(
  '/',
  authMiddleware,
  purchaseLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { agentProfileId, txHash } = req.body;
    const walletAddress = req.walletAddress!;

    if (!agentProfileId) throw new AppError(400, 'Missing agentProfileId');

    const agent = await supabase.getAgentProfile(agentProfileId);
    if (!agent) throw new AppError(404, 'Agent not found');

    const price = RISK_PRICE[(agent as any).risk_tier] ?? 1;

    // Fetch current balance directly (snake_case from DB)
    const userData = await supabase.getOrCreateUser(walletAddress);
    const currentBalance = Number((userData as any).total_balance ?? 0);

    if (currentBalance < price) {
      throw new AppError(402, `Insufficient balance — need $${price}, have $${currentBalance.toFixed(2)}`);
    }

    // Deduct balance first (atomic-ish) with ledger entry
    const agentName = (agent as any).name || 'Unknown Agent';
    const { newBalance } = await supabase.creditBalance(
      walletAddress, 
      -price,
      'purchase',
      {
        agentProfileId,
        agentName,
        agentRiskTier: (agent as any).risk_tier,
        note: `Purchased ${agentName} (${(agent as any).risk_tier} tier) for $${price}`
      }
    );
    cache.delete(`balance:${walletAddress}`);

    // Create purchase record
    const duration = 4 + Math.random() * 20;
    const purchase = await supabase.createPurchase(walletAddress, agentProfileId, price, Math.round(duration));

    // Remove from marketplace + backfill
    try {
      const listings = await supabase.getMarketplaceListings(1, 1000);
      const listing = listings.listings.find((l: any) => l.agent_profile_id === agentProfileId);
      if (listing) {
        await supabase.removeListing(listing.id);
        const inactive = await supabase.getInactiveProfiles(5);
        if (inactive.length > 0) await supabase.createListing(inactive[0].id);
      }
    } catch {}

    // Invalidate caches
    cache.clearPattern?.('marketplace:');

    res.status(201).json({
      success: true,
      data: {
        ...purchase,
        priceCharged: price,
        newBalance,
        agentName: (agent as any).name,
        agentRiskTier: (agent as any).risk_tier,
      },
      timestamp: new Date().toISOString()
    });
  })
);

// GET /purchases/pending
router.get(
  '/pending',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const walletAddress = req.walletAddress!;
    const purchases = await supabase.getPendingPurchases(walletAddress);

    res.json({
      success: true,
      data: purchases,
      timestamp: new Date().toISOString()
    });
  })
);

// GET /purchases/history
router.get(
  '/history',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const walletAddress = req.walletAddress!;
    const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
    const purchases = await supabase.getPurchaseHistory(walletAddress, limit);

    res.json({
      success: true,
      data: purchases,
      timestamp: new Date().toISOString()
    });
  })
);

export default router;
