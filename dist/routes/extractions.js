"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crypto = __importStar(require("crypto"));
const supabase_1 = require("../services/supabase");
const cache_1 = require("../services/cache");
const errorHandler_1 = require("../middleware/errorHandler");
const auth_1 = require("../middleware/auth");
const rateLimiter_1 = require("../middleware/rateLimiter");
const router = (0, express_1.Router)();
function seededRandom(seed) {
    const hash = crypto.createHash('md5').update(seed).digest('hex');
    return parseInt(hash.substring(0, 8), 16) / 0xffffffff;
}
function generateRewardDetailed(purchaseId, riskTier, volatilityMod) {
    const seed = `${purchaseId}${new Date().toISOString().split('T')[0]}`;
    const rand = seededRandom(seed);
    let amount;
    let probabilityTier;
    if (rand < 0.7) {
        const min = 0.25, max = 1.0;
        amount = min + seededRandom(seed + 'a') * (max - min);
        probabilityTier = 'common (70%)';
    }
    else if (rand < 0.95) {
        const min = 1.0, max = 5.0;
        amount = min + seededRandom(seed + 'b') * (max - min);
        probabilityTier = 'uncommon (25%)';
    }
    else if (rand < 0.99) {
        const min = 5.0, max = 10.0;
        amount = min + seededRandom(seed + 'c') * (max - min);
        probabilityTier = 'rare (4%)';
    }
    else {
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
function generateReward(purchaseId, riskTier, volatilityMod) {
    return generateRewardDetailed(purchaseId, riskTier, volatilityMod).finalReward;
}
// POST /extractions/:id/initiate — one-shot, enforced on backend
router.post('/:id/initiate', auth_1.authMiddleware, rateLimiter_1.extractionLimiter, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const purchaseId = req.params.id;
    const walletAddress = req.walletAddress;
    console.log(`[Extraction] Starting extraction for purchase ${purchaseId} by ${walletAddress}`);
    // Only allow purchases with status 'purchased' (pending)
    const purchases = await supabase_1.supabase.getPendingPurchases(walletAddress);
    const purchase = purchases.find((p) => p.id === purchaseId);
    if (!purchase) {
        console.log(`[Extraction] Purchase not found or already extracted: ${purchaseId}`);
        throw new errorHandler_1.AppError(404, 'Purchase not found or already extracted');
    }
    const purchaseAgentId = purchase.agent_profile_id || purchase.agentProfileId;
    console.log(`[Extraction] Found purchase: ${JSON.stringify({
        id: purchase.id,
        agent_profile_id: purchaseAgentId,
        status: purchase.status
    })}`);
    // Immediately mark as 'extracting' to prevent race conditions / double extraction
    await supabase_1.supabase.updatePurchase(purchaseId, {
        status: 'extracting',
        extraction_initiated_at: new Date().toISOString()
    });
    const agent = await supabase_1.supabase.getAgentProfile(purchase.agent_profile_id);
    if (!agent) {
        console.error(`[Extraction] Agent not found: ${purchase.agent_profile_id}`);
        // Rollback status
        await supabase_1.supabase.updatePurchase(purchaseId, { status: 'purchased' });
        throw new errorHandler_1.AppError(404, 'Agent not found');
    }
    // Extract agent properties with proper type conversion
    const riskTier = String(agent.risk_tier || 'medium');
    const volatilityMod = Number(agent.volatility_mod || 1.0);
    const agentId = String(agent.id);
    const agentName = String(agent.name || 'Unknown');
    console.log(`[Extraction] Agent details: ${JSON.stringify({
        id: agentId,
        name: agentName,
        risk_tier: riskTier,
        volatility_mod: volatilityMod,
        volatility_mod_type: typeof agent.volatility_mod
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
    const creditResult = await supabase_1.supabase.creditBalance(walletAddress, reward, 'extraction', {
        purchaseId,
        agentId,
        agentName,
        note: `Extracted $${reward} from ${agentName} (${riskTier} tier, ${safeVolatilityMod}x volatility)`
    });
    console.log(`[Extraction] Balance updated: ${JSON.stringify(creditResult)}`);
    // Mark as completed (one-way, cannot be re-extracted)
    await supabase_1.supabase.updatePurchase(purchaseId, {
        status: 'completed',
        extraction_completed_at: new Date().toISOString(),
        extracted_amount: reward
    });
    cache_1.cache.delete(`balance:${walletAddress}`);
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
}));
// GET /extractions/:id/preview — preview reward without extracting (idempotent)
router.get('/:id/preview', auth_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const purchaseId = req.params.id;
    const walletAddress = req.walletAddress;
    // Get purchase
    const purchases = await supabase_1.supabase.getPendingPurchases(walletAddress);
    const purchase = purchases.find((p) => p.id === purchaseId);
    if (!purchase) {
        throw new errorHandler_1.AppError(404, 'Purchase not found or already extracted');
    }
    // Get agent
    const agent = await supabase_1.supabase.getAgentProfile(purchase.agent_profile_id);
    if (!agent) {
        throw new errorHandler_1.AppError(404, 'Agent not found');
    }
    const riskTier = String(agent.risk_tier || 'medium');
    const volatilityMod = Number(agent.volatility_mod || 1.0);
    const safeVolatilityMod = Math.min(Math.max(volatilityMod, 0.8), 1.4);
    // Generate preview (deterministic based on purchaseId + date)
    const preview = generateRewardDetailed(purchaseId, riskTier, safeVolatilityMod);
    // Get user's current balance
    const userData = await supabase_1.supabase.getUserBalance(walletAddress);
    const currentBalance = Number(userData?.total_balance ?? 0);
    res.json({
        success: true,
        data: {
            purchaseId,
            agentId: agent.id,
            agentName: agent.name,
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
}));
exports.default = router;
//# sourceMappingURL=extractions.js.map