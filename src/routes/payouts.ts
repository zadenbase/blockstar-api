import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabase';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// POST /payouts/request
router.post(
  '/request',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { amountRequested } = req.body;
    const walletAddress = req.walletAddress!;

    if (!amountRequested || amountRequested <= 0) {
      throw new AppError(400, 'Invalid amount');
    }

    // Get user
    const user = await supabase.getUserBalance(walletAddress);
    if (!user) {
      throw new AppError(404, 'User not found');
    }

    // Check eligibility (30+ days)
    const daysSince = Math.floor((Date.now() - new Date(user.firstActivityAt).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince < 30) {
      throw new AppError(400, `Payout available in ${30 - daysSince} days`);
    }

    // Check balance
    if (user.totalBalance < amountRequested) {
      throw new AppError(400, 'Insufficient balance');
    }

    // Create payout request
    const payout = await supabase.createPayoutRequest(walletAddress, amountRequested, daysSince);

    res.status(201).json({
      success: true,
      data: payout,
      timestamp: new Date().toISOString()
    });
  })
);

// GET /payouts/:id/status
router.get(
  '/:id/status',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const payoutId = req.params.id;

    const payout = await supabase.getPayoutStatus(payoutId);
    if (!payout) {
      throw new AppError(404, 'Payout not found');
    }

    // Verify user owns this payout
    if (req.walletAddress !== payout.userId) {
      throw new AppError(403, 'Unauthorized');
    }

    res.json({
      success: true,
      data: payout,
      timestamp: new Date().toISOString()
    });
  })
);

// GET /users/:wallet/payouts
router.get(
  '/users/:wallet/payouts',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const walletAddress = req.params.wallet;

    // Verify user is requesting their own payouts
    if (req.walletAddress !== walletAddress) {
      throw new AppError(403, 'Unauthorized');
    }

    const payouts = await supabase.getPayoutHistory(walletAddress);

    res.json({
      success: true,
      data: payouts,
      timestamp: new Date().toISOString()
    });
  })
);

export default router;
