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

interface RewardBreakdown {
  baseAmount: number;
  volatilityMod: number;
  finalReward: number;
  tier: string;
  probabilityTier: string;
}

function generateRewardDetailed(purchaseId: string, riskTier: string, volatilityMod: number): RewardBreakdown {
  const seed = `${purchaseId}${new Date().toISOString().split('T')[0]}`;
  const rand = seededRandom(seed);

  let amount: number;
  let probabilityTier: string;
  
  if (rand < 0.7) {
    const min = 0.25, max = 1.0;
    amount = min + seededRandom(seed + 'a') * (max - min);
    probabilityTier = 'common (70%)';
  } else if (rand < 0.95) {
    const min = 1.0, max = 5.0;
    amount = min + seededRandom(seed + 'b') * (max - min);
    probabilityTier = 'uncommon (25%)';
  } else if (rand < 0.99) {
    const min = 5.0, max = 10.0;
    amount = min + seededRandom(seed + 'c') * (max - min);
    probabilityTier = 'rare (4%)';
  } else {
    const min = 10.0, max = 50.0;
    amount = min + seededRandom(seed + 'd') * (max - min);
    probabilityTier = 'legendary (1%)';
  }

  const finalReward = Math.round((amount * volatilityMod) * 100) / 100;
  
  return {
    baseAmount: Math.round(amount * 100) / 100,
    volatilityMod,
    finalReward,
    tier: riskTier,
    probabilityTier
  };
}

function generateReward(purchaseId: string, riskTier: string, volatilityMod: number): number {
  return generateRewardDetailed(purchaseId, riskTier, volatilityMod).finalReward;
}

// POST /extractions/:id/initiate — one-shot, enforced on backend
router.post(
  '/:id/initiate',
  authMiddleware,
  extractionLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const purchaseId = req.params.id;
    const walletAddress = req.walletAddress!;

    console.log(`[Extraction] Starting extraction for purchase ${purchaseId} by ${walletAddress}`);

    // Only allow purchases with status 'purchased' (pending)
    const purchases = await supabase.getPendingPurchases(walletAddress);
    const purchase = purchases.find((p: any) => p.id === purchaseId);

    if (!purchase) {
      console.log(`[Extraction] Purchase not found or already extracted: ${purchaseId}`);
      throw new AppError(404, 'Purchase not found or already extracted');
    }

    const purchaseAgentId = (purchase as any).agent_profile_id || (purchase as any).agentProfileId;
    console.log(`[Extraction] Found purchase: ${JSON.stringify({
      id: purchase.id,
      agent_profile_id: purchaseAgentId,
      status: (purchase as any).status
    })}`);

    // Immediately mark as 'extracting' to prevent race conditions / double extraction
    await supabase.updatePurchase(purchaseId, {
      status: 'extracting',
      extraction_initiated_at: new Date().toISOString()
    } as any);

    const agent = await supabase.getAgentProfile((purchase as any).agent_profile_id);
    if (!agent) {
      console.error(`[Extraction] Agent not found: ${(purchase as any).agent_profile_id}`);
      // Rollback status
      await supabase.updatePurchase(purchaseId, { status: 'purchased' } as any);
      throw new AppError(404, 'Agent not found');
    }

    // Extract agent properties with proper type conversion
    const riskTier = String((agent as any).risk_tier || 'medium');
    const volatilityMod = Number((agent as any).volatility_mod || 1.0);
    const agentId = String((agent as any).id);
    const agentName = String((agent as any).name || 'Unknown');

    console.log(`[Extraction] Agent details: ${JSON.stringify({
      id: agentId,
      name: agentName,
      risk_tier: riskTier,
      volatility_mod: volatilityMod,
      volatility_mod_type: typeof (agent as any).volatility_mod
    })}`);

    // Validate volatility modifier is within expected range
    if (isNaN(volatilityMod) || volatilityMod < 0.8 || volatilityMod > 1.4) {
      console.error(`[Extraction] Invalid volatility_mod: ${volatilityMod}, using 1.0 as fallback`);
    }

    const safeVolatilityMod = Math.min(Math.max(volatilityMod, 0.8), 1.4);
    const reward = generateReward(purchaseId, riskTier, safeVolatilityMod);

    console.log(`[Extraction] Reward calculation: ${JSON.stringify({
      purchaseId,
      riskTier,
      raw_volatility_mod: volatilityMod,
      safe_volatility_mod: safeVolatilityMod,
      calculated_reward: reward
    })}`);

    // Credit balance with ledger entry
    const creditResult = await supabase.creditBalance(
      walletAddress, 
      reward,
      'extraction',
      {
        purchaseId,
        agentId,
        agentName,
        note: `Extracted $${reward} from ${agentName} (${riskTier} tier, ${safeVolatilityMod}x volatility)`
      }
    );
    console.log(`[Extraction] Balance updated: ${JSON.stringify(creditResult)}`);

    // Mark as completed (one-way, cannot be re-extracted)
    await supabase.updatePurchase(purchaseId, {
      status: 'completed',
      extraction_completed_at: new Date().toISOString(),
      extracted_amount: reward
    } as any);

    cache.delete(`balance:${walletAddress}`);

    console.log(`[Extraction] Completed: reward=${reward}, agent=${agentName}`);

    res.json({
      success: true,
      data: { 
        purchaseId, 
        agentId, 
        agentName,
        agentRiskTier: riskTier,
        agentVolatilityMod: safeVolatilityMod,
        reward, 
        status: 'completed',
        previousBalance: creditResult.previous,
        newBalance: creditResult.newBalance
      },
      timestamp: new Date().toISOString()
    });
  })
);

// GET /extractions/:id/preview — preview reward without extracting (idempotent)
router.get(
  '/:id/preview',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const purchaseId = req.params.id;
    const walletAddress = req.walletAddress!;

    // Get purchase
    const purchases = await supabase.getPendingPurchases(walletAddress);
    const purchase = purchases.find((p: any) => p.id === purchaseId);

    if (!purchase) {
      throw new AppError(404, 'Purchase not found or already extracted');
    }

    // Get agent
    const agent = await supabase.getAgentProfile((purchase as any).agent_profile_id);
    if (!agent) {
      throw new AppError(404, 'Agent not found');
    }

    const riskTier = String((agent as any).risk_tier || 'medium');
    const volatilityMod = Number((agent as any).volatility_mod || 1.0);
    const safeVolatilityMod = Math.min(Math.max(volatilityMod, 0.8), 1.4);

    // Generate preview (deterministic based on purchaseId + date)
    const preview = generateRewardDetailed(purchaseId, riskTier, safeVolatilityMod);

    // Get user's current balance
    const userData = await supabase.getUserBalance(walletAddress);
    const currentBalance = Number((userData as any)?.total_balance ?? 0);

    res.json({
      success: true,
      data: {
        purchaseId,
        agentId: (agent as any).id,
        agentName: (agent as any).name,
        agentRiskTier: riskTier,
        agentVolatilityMod: safeVolatilityMod,
        expectedReward: preview.finalReward,
        rewardBreakdown: {
          baseAmount: preview.baseAmount,
          volatilityMultiplier: preview.volatilityMod,
          probabilityTier: preview.probabilityTier,
          calculation: `$${preview.baseAmount} × ${preview.volatilityMod} = $${preview.finalReward}`
        },
        currentBalance,
        projectedBalance: Math.round((currentBalance + preview.finalReward) * 10000) / 10000,
        note: 'This is a preview. Actual reward will be the same if extracted today.',
        canExtract: true
      },
      timestamp: new Date().toISOString()
    });
  })
);

export default router;
