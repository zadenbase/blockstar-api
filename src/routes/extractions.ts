import { Router, Request, Response } from 'express';
import * as crypto from 'crypto';
import { supabase } from '../services/supabase';
import { cache } from '../services/cache';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { authMiddleware } from '../middleware/auth';
import { extractionLimiter } from '../middleware/rateLimiter';

const router = Router();

function seededRandom(seed: string): number {
  const hash = crypto.createHash('md5').update(seed).digest('hex');
  return parseInt(hash.substring(0, 8), 16) / 0xffffffff;
}

function generateReward(purchaseId: string, riskTier: string, volatilityMod: number): number {
  const seed = `${purchaseId}${new Date().toISOString().split('T')[0]}`;
  const rand = seededRandom(seed);

  let amount: number;
  if (rand < 0.7) {
    const min = 0.25,
      max = 1.0;
    amount = min + seededRandom(seed + 'a') * (max - min);
  } else if (rand < 0.95) {
    const min = 1.0,
      max = 5.0;
    amount = min + seededRandom(seed + 'b') * (max - min);
  } else if (rand < 0.99) {
    const min = 5.0,
      max = 10.0;
    amount = min + seededRandom(seed + 'c') * (max - min);
  } else {
    const min = 10.0,
      max = 50.0;
    amount = min + seededRandom(seed + 'd') * (max - min);
  }

  return Math.round((amount * volatilityMod) * 100) / 100;
}

// POST /extractions/:id/initiate
router.post(
  '/:id/initiate',
  authMiddleware,
  extractionLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const purchaseId = req.params.id;
    const walletAddress = req.walletAddress!;

    // Get purchase
    const purchases = await supabase.getPendingPurchases(walletAddress);
    const purchase = purchases.find((p) => p.id === purchaseId);

    if (!purchase) {
      throw new AppError(404, 'Purchase not found or not pending');
    }

    // Check if extraction window is open
    const now = new Date();
    const extractionEnd = new Date(purchase.extractionEndTime);
    if (now > extractionEnd) {
      throw new AppError(400, 'Extraction window has closed');
    }

    // Get agent for reward calculation
    const agent = await supabase.getAgentProfile(purchase.agentProfileId);
    if (!agent) {
      throw new AppError(404, 'Agent not found');
    }

    // Mark as extracting
    const updated = await supabase.updatePurchase(purchaseId, {
      ...purchase,
      status: 'extracting',
      extractionInitiatedAt: now.toISOString()
    });

    // Generate reward
    const reward = generateReward(purchaseId, agent.riskTier, agent.volatilityMod);

    // Credit balance (in real system: after timer runs out)
    // For MVP: credit immediately
    await supabase.addBalance(walletAddress, reward, 'extraction', purchaseId);

    // Mark as completed
    await supabase.updatePurchase(purchaseId, {
      ...updated,
      status: 'completed',
      extractionCompletedAt: new Date().toISOString(),
      extractedAmount: reward
    });

    // Invalidate balance cache (balance changed)
    cache.delete(`balance:${walletAddress}`);

    res.json({
      success: true,
      data: {
        purchaseId,
        agentId: agent.id,
        reward,
        status: 'completed'
      },
      timestamp: new Date().toISOString()
    });
  })
);

export default router;
