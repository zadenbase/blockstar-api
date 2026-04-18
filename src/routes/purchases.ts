import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabase';
import { cache } from '../services/cache';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { authMiddleware } from '../middleware/auth';
import { purchaseLimiter } from '../middleware/rateLimiter';

const router = Router();

// POST /purchases
router.post(
  '/',
  authMiddleware,
  purchaseLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { agentProfileId } = req.body;
    const walletAddress = req.walletAddress!;

    if (!agentProfileId) {
      throw new AppError(400, 'Missing agentProfileId');
    }

    // Get agent
    const agent = await supabase.getAgentProfile(agentProfileId);
    if (!agent) {
      throw new AppError(404, 'Agent not found');
    }

    // Check balance (simplified)
    const user = await supabase.getOrCreateUser(walletAddress);
    const price = 0.5; // Fixed price for MVP

    if (user.totalBalance < price) {
      throw new AppError(400, 'Insufficient balance');
    }

    // Create purchase (4-24h random extraction window)
    const duration = 4 + Math.random() * 20; // 4-24 hours
    const purchase = await supabase.createPurchase(walletAddress, agentProfileId, price, Math.round(duration));

    // Deduct from balance
    await supabase.addBalance(walletAddress, -price, 'purchase', purchase.id);

    // Remove listing
    const listings = await supabase.getMarketplaceListings(1, 1000);
    const listing = listings.listings.find((l) => l.agent_profile_id === agentProfileId);
    if (listing) {
      await supabase.removeListing(listing.id);

      // Backfill marketplace (add new agent)
      const inactive = await supabase.getInactiveProfiles(5);
      if (inactive.length > 0) {
        await supabase.createListing(inactive[0].id);
      }

      // Invalidate marketplace cache (since listings changed)
      cache.delete(`balance:${walletAddress}`); // Also invalidate user balance cache
    }

    res.status(201).json({
      success: true,
      data: purchase,
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
