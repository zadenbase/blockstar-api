"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supabase_1 = require("../services/supabase");
const cache_1 = require("../services/cache");
const errorHandler_1 = require("../middleware/errorHandler");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// GET /users/:wallet/balance
router.get('/:wallet/balance', auth_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const walletAddress = req.params.wallet;
    // Verify user is requesting their own balance
    if (req.walletAddress !== walletAddress) {
        throw new errorHandler_1.AppError(403, 'Unauthorized');
    }
    // Cache key with wallet
    const cacheKey = `balance:${walletAddress}`;
    // Check cache (10 second TTL - balance updates are infrequent)
    let user = cache_1.cache.get(cacheKey);
    if (user) {
        res.json({
            success: true,
            data: { ...user, cached: true },
            timestamp: new Date().toISOString()
        });
        return;
    }
    // Fetch from DB
    user = await supabase_1.supabase.getUserBalance(walletAddress);
    if (!user) {
        throw new errorHandler_1.AppError(404, 'User not found');
    }
    // Cache for 10 seconds
    cache_1.cache.set(cacheKey, user, 10);
    res.json({
        success: true,
        data: user,
        timestamp: new Date().toISOString()
    });
}));
// GET /users/:wallet/balance-history
router.get('/:wallet/balance-history', auth_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const walletAddress = req.params.wallet;
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    // Verify user is requesting their own history
    if (req.walletAddress !== walletAddress) {
        throw new errorHandler_1.AppError(403, 'Unauthorized');
    }
    const history = await supabase_1.supabase.getBalanceHistory(walletAddress, limit);
    res.json({
        success: true,
        data: history,
        timestamp: new Date().toISOString()
    });
}));
// GET /users/:wallet/payouts
router.get('/:wallet/payouts', auth_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const walletAddress = req.params.wallet;
    if (req.walletAddress !== walletAddress)
        throw new errorHandler_1.AppError(403, 'Unauthorized');
    const payouts = await supabase_1.supabase.getPayoutHistory(walletAddress);
    res.json({ success: true, data: payouts, timestamp: new Date().toISOString() });
}));
exports.default = router;
//# sourceMappingURL=balance.js.map