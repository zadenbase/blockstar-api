import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabase';
import { cache } from '../services/cache';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// GET /users/:wallet/balance
router.get(
  '/:wallet/balance',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const walletAddress = req.params.wallet;

    // Verify user is requesting their own balance
    if (req.walletAddress !== walletAddress) {
      throw new AppError(403, 'Unauthorized');
    }

    // Cache key with wallet
    const cacheKey = `balance:${walletAddress}`;

    // Check cache (10 second TTL - balance updates are infrequent)
    let user = cache.get<any>(cacheKey);
    if (user) {
      res.json({
        success: true,
        data: { ...user, cached: true },
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Fetch from DB
    user = await supabase.getUserBalance(walletAddress);
    if (!user) {
      throw new AppError(404, 'User not found');
    }

    // Cache for 10 seconds
    cache.set(cacheKey, user, 10);

    res.json({
      success: true,
      data: user,
      timestamp: new Date().toISOString()
    });
  })
);

// GET /users/:wallet/balance-history
router.get(
  '/:wallet/balance-history',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const walletAddress = req.params.wallet;
    const limit = Math.min(100, parseInt(req.query.limit as string) || 20);

    // Verify user is requesting their own history
    if (req.walletAddress !== walletAddress) {
      throw new AppError(403, 'Unauthorized');
    }

    const history = await supabase.getBalanceHistory(walletAddress, limit);

    res.json({
      success: true,
      data: history,
      timestamp: new Date().toISOString()
    });
  })
);

export default router;
