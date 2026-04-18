"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supabase_1 = require("../services/supabase");
const errorHandler_1 = require("../middleware/errorHandler");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// POST /payouts/request
router.post('/request', auth_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { amountRequested } = req.body;
    const walletAddress = req.walletAddress;
    if (!amountRequested || amountRequested <= 0) {
        throw new errorHandler_1.AppError(400, 'Invalid amount');
    }
    // Get user
    const user = await supabase_1.supabase.getUserBalance(walletAddress);
    if (!user) {
        throw new errorHandler_1.AppError(404, 'User not found');
    }
    // Check eligibility (30+ days)
    const daysSince = Math.floor((Date.now() - new Date(user.firstActivityAt).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince < 30) {
        throw new errorHandler_1.AppError(400, `Payout available in ${30 - daysSince} days`);
    }
    // Check balance
    if (user.totalBalance < amountRequested) {
        throw new errorHandler_1.AppError(400, 'Insufficient balance');
    }
    // Create payout request
    const payout = await supabase_1.supabase.createPayoutRequest(walletAddress, amountRequested, daysSince);
    res.status(201).json({
        success: true,
        data: payout,
        timestamp: new Date().toISOString()
    });
}));
// GET /payouts/:id/status
router.get('/:id/status', auth_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const payoutId = req.params.id;
    const payout = await supabase_1.supabase.getPayoutStatus(payoutId);
    if (!payout) {
        throw new errorHandler_1.AppError(404, 'Payout not found');
    }
    // Verify user owns this payout
    if (req.walletAddress !== payout.userId) {
        throw new errorHandler_1.AppError(403, 'Unauthorized');
    }
    res.json({
        success: true,
        data: payout,
        timestamp: new Date().toISOString()
    });
}));
// GET /users/:wallet/payouts
router.get('/users/:wallet/payouts', auth_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const walletAddress = req.params.wallet;
    // Verify user is requesting their own payouts
    if (req.walletAddress !== walletAddress) {
        throw new errorHandler_1.AppError(403, 'Unauthorized');
    }
    const payouts = await supabase_1.supabase.getPayoutHistory(walletAddress);
    res.json({
        success: true,
        data: payouts,
        timestamp: new Date().toISOString()
    });
}));
exports.default = router;
//# sourceMappingURL=payouts.js.map