"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supabase_1 = require("../services/supabase");
const cache_1 = require("../services/cache");
const errorHandler_1 = require("../middleware/errorHandler");
const auth_1 = require("../middleware/auth");
const rateLimiter_1 = require("../middleware/rateLimiter");
const router = (0, express_1.Router)();
// POST /purchases
router.post('/', auth_1.authMiddleware, rateLimiter_1.purchaseLimiter, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { agentProfileId } = req.body;
    const walletAddress = req.walletAddress;
    if (!agentProfileId) {
        throw new errorHandler_1.AppError(400, 'Missing agentProfileId');
    }
    // Get agent
    const agent = await supabase_1.supabase.getAgentProfile(agentProfileId);
    if (!agent) {
        throw new errorHandler_1.AppError(404, 'Agent not found');
    }
    // Check balance (simplified)
    const user = await supabase_1.supabase.getOrCreateUser(walletAddress);
    const price = 0.5; // Fixed price for MVP
    if (user.totalBalance < price) {
        throw new errorHandler_1.AppError(400, 'Insufficient balance');
    }
    // Create purchase (4-24h random extraction window)
    const duration = 4 + Math.random() * 20; // 4-24 hours
    const purchase = await supabase_1.supabase.createPurchase(walletAddress, agentProfileId, price, Math.round(duration));
    // Deduct from balance
    await supabase_1.supabase.addBalance(walletAddress, -price, 'purchase', purchase.id);
    // Remove listing
    const listings = await supabase_1.supabase.getMarketplaceListings(1, 1000);
    const listing = listings.listings.find((l) => l.agent_profile_id === agentProfileId);
    if (listing) {
        await supabase_1.supabase.removeListing(listing.id);
        // Backfill marketplace (add new agent)
        const inactive = await supabase_1.supabase.getInactiveProfiles(5);
        if (inactive.length > 0) {
            await supabase_1.supabase.createListing(inactive[0].id);
        }
        // Invalidate marketplace cache (since listings changed)
        cache_1.cache.delete(`balance:${walletAddress}`); // Also invalidate user balance cache
    }
    res.status(201).json({
        success: true,
        data: purchase,
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