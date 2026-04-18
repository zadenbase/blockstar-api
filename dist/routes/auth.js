"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ethers_1 = require("ethers");
const supabase_1 = require("../services/supabase");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const rateLimiter_1 = require("../middleware/rateLimiter");
const router = (0, express_1.Router)();
const MESSAGE = 'Sign this message to connect to Blockstar';
function verifySignature(address, signature) {
    try {
        const recovered = ethers_1.ethers.verifyMessage(MESSAGE, signature);
        return recovered.toLowerCase() === address.toLowerCase();
    }
    catch {
        return false;
    }
}
// POST /auth/verify
router.post('/verify', rateLimiter_1.authLimiter, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { walletAddress, signature } = req.body;
    if (!walletAddress || !signature) {
        throw new errorHandler_1.AppError(400, 'Missing walletAddress or signature');
    }
    if (!walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
        throw new errorHandler_1.AppError(400, 'Invalid wallet address');
    }
    // Verify signature
    if (!verifySignature(walletAddress, signature)) {
        throw new errorHandler_1.AppError(401, 'Invalid signature');
    }
    // Get or create user
    const user = await supabase_1.supabase.getOrCreateUser(walletAddress);
    // Generate token
    const token = (0, auth_1.generateToken)(walletAddress);
    const expiresAt = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
    res.json({
        success: true,
        data: {
            token,
            expiresAt,
            user
        },
        timestamp: new Date().toISOString()
    });
}));
// POST /auth/qr
router.post('/qr', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    // Generate QR code data
    const qrToken = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
    const qrUrl = `${process.env.APP_URL || 'http://localhost:3000'}/auth/callback?token=${qrToken}`;
    res.json({
        success: true,
        data: {
            qrUrl,
            token: qrToken
        },
        timestamp: new Date().toISOString()
    });
}));
exports.default = router;
//# sourceMappingURL=auth.js.map