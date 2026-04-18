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
function generateReward(purchaseId, riskTier, volatilityMod) {
    const seed = `${purchaseId}${new Date().toISOString().split('T')[0]}`;
    const rand = seededRandom(seed);
    let amount;
    if (rand < 0.7) {
        const min = 0.25, max = 1.0;
        amount = min + seededRandom(seed + 'a') * (max - min);
    }
    else if (rand < 0.95) {
        const min = 1.0, max = 5.0;
        amount = min + seededRandom(seed + 'b') * (max - min);
    }
    else if (rand < 0.99) {
        const min = 5.0, max = 10.0;
        amount = min + seededRandom(seed + 'c') * (max - min);
    }
    else {
        const min = 10.0, max = 50.0;
        amount = min + seededRandom(seed + 'd') * (max - min);
    }
    return Math.round((amount * volatilityMod) * 100) / 100;
}
// POST /extractions/:id/initiate
router.post('/:id/initiate', auth_1.authMiddleware, rateLimiter_1.extractionLimiter, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const purchaseId = req.params.id;
    const walletAddress = req.walletAddress;
    // Get purchase
    const purchases = await supabase_1.supabase.getPendingPurchases(walletAddress);
    const purchase = purchases.find((p) => p.id === purchaseId);
    if (!purchase) {
        throw new errorHandler_1.AppError(404, 'Purchase not found or not pending');
    }
    // Check if extraction window is open
    const now = new Date();
    const extractionEnd = new Date(purchase.extractionEndTime);
    if (now > extractionEnd) {
        throw new errorHandler_1.AppError(400, 'Extraction window has closed');
    }
    // Get agent for reward calculation
    const agent = await supabase_1.supabase.getAgentProfile(purchase.agentProfileId);
    if (!agent) {
        throw new errorHandler_1.AppError(404, 'Agent not found');
    }
    // Mark as extracting
    const updated = await supabase_1.supabase.updatePurchase(purchaseId, {
        ...purchase,
        status: 'extracting',
        extractionInitiatedAt: now.toISOString()
    });
    // Generate reward
    const reward = generateReward(purchaseId, agent.riskTier, agent.volatilityMod);
    // Credit balance (in real system: after timer runs out)
    // For MVP: credit immediately
    await supabase_1.supabase.addBalance(walletAddress, reward, 'extraction', purchaseId);
    // Mark as completed
    await supabase_1.supabase.updatePurchase(purchaseId, {
        ...updated,
        status: 'completed',
        extractionCompletedAt: new Date().toISOString(),
        extractedAmount: reward
    });
    // Invalidate balance cache (balance changed)
    cache_1.cache.delete(`balance:${walletAddress}`);
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
}));
exports.default = router;
//# sourceMappingURL=extractions.js.map