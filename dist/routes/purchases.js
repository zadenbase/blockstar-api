"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supabase_1 = require("../services/supabase");
const cache_1 = require("../services/cache");
const errorHandler_1 = require("../middleware/errorHandler");
const auth_1 = require("../middleware/auth");
const rateLimiter_1 = require("../middleware/rateLimiter");
const router = (0, express_1.Router)();
// Risk tier → price mapping
const RISK_PRICE = {
    low: 1, medium: 5, high: 25, extreme: 100,
};
// POST /purchases — deducts from internal balance (no on-chain tx required)
router.post('/', auth_1.authMiddleware, rateLimiter_1.purchaseLimiter, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { agentProfileId, txHash } = req.body;
    const walletAddress = req.walletAddress;
    if (!agentProfileId)
        throw new errorHandler_1.AppError(400, 'Missing agentProfileId');
    const agent = await supabase_1.supabase.getAgentProfile(agentProfileId);
    if (!agent)
        throw new errorHandler_1.AppError(404, 'Agent not found');
    const price = RISK_PRICE[agent.risk_tier] ?? 1;
    // Fetch current balance directly (snake_case from DB)
    const userData = await supabase_1.supabase.getOrCreateUser(walletAddress);
    const currentBalance = Number(userData.total_balance ?? 0);
    if (currentBalance < price) {
        throw new errorHandler_1.AppError(402, `Insufficient balance — need $${price}, have $${currentBalance.toFixed(2)}`);
    }
    // Deduct balance first (atomic-ish) with ledger entry
    const agentName = agent.name || 'Unknown Agent';
    const { newBalance } = await supabase_1.supabase.creditBalance(walletAddress, -price, 'purchase', {
        agentProfileId,
        agentName,
        agentRiskTier: agent.risk_tier,
        note: `Purchased ${agentName} (${agent.risk_tier} tier) for $${price}`
    });
    cache_1.cache.delete(`balance:${walletAddress}`);
    // Create purchase record
    const duration = 4 + Math.random() * 20;
    const purchase = await supabase_1.supabase.createPurchase(walletAddress, agentProfileId, price, Math.round(duration));
    // Remove from marketplace + backfill
    try {
        const listings = await supabase_1.supabase.getMarketplaceListings(1, 1000);
        const listing = listings.listings.find((l) => l.agent_profile_id === agentProfileId);
        if (listing) {
            await supabase_1.supabase.removeListing(listing.id);
            const inactive = await supabase_1.supabase.getInactiveProfiles(5);
            if (inactive.length > 0)
                await supabase_1.supabase.createListing(inactive[0].id);
        }
    }
    catch { }
    // Invalidate caches
    cache_1.cache.clearPattern?.('marketplace:');
    res.status(201).json({
        success: true,
        data: {
            ...purchase,
            priceCharged: price,
            newBalance,
            agentName: agent.name,
            agentRiskTier: agent.risk_tier,
        },
        timestamp: new Date().toISOString()
    });
}));
// GET /purchases/pending
router.get('/pending', auth_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const walletAddress = req.walletAddress;
    const purchases = await supabase_1.supabase.getPendingPurchases(walletAddress);
    res.json({
        success: true,
        data: purchases,
        timestamp: new Date().toISOString()
    });
}));
// GET /purchases/history
router.get('/history', auth_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const walletAddress = req.walletAddress;
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const purchases = await supabase_1.supabase.getPurchaseHistory(walletAddress, limit);
    res.json({
        success: true,
        data: purchases,
        timestamp: new Date().toISOString()
    });
}));
exports.default = router;
//# sourceMappingURL=purchases.js.map