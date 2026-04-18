"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supabase_1 = require("../services/supabase");
const cache_1 = require("../services/cache");
const errorHandler_1 = require("../middleware/errorHandler");
const auth_1 = require("../middleware/auth");
const rateLimiter_1 = require("../middleware/rateLimiter");
const router = (0, express_1.Router)();
// GET /marketplace/listings
router.get('/listings', rateLimiter_1.marketplaceLimiter, auth_1.optionalAuth, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    const riskTier = req.query.riskTier;
    const region = req.query.region;
    // Cache key: include filters
    const cacheKey = `marketplace:page=${page}:limit=${limit}:risk=${riskTier || 'all'}:region=${region || 'all'}`;
    // Check cache first (5 min TTL)
    let result = cache_1.cache.get(cacheKey);
    if (result) {
        res.json({
            success: true,
            data: { ...result, cached: true },
            timestamp: new Date().toISOString()
        });
        return;
    }
    // Not cached, fetch from DB
    const { listings, agents, total } = await supabase_1.supabase.getMarketplaceListings(page, limit, {
        riskTier,
        region
    });
    const data = {
        listings,
        agents,
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
    };
    // Cache for 5 minutes
    cache_1.cache.set(cacheKey, data, 300);
    res.json({
        success: true,
        data,
        timestamp: new Date().toISOString()
    });
}));
// GET /marketplace/agents/:id
router.get('/agents/:id', auth_1.optionalAuth, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const agent = await supabase_1.supabase.getAgentProfile(req.params.id);
    if (!agent) {
        throw new errorHandler_1.AppError(404, 'Agent not found');
    }
    res.json({
        success: true,
        data: agent,
        timestamp: new Date().toISOString()
    });
}));
exports.default = router;
//# sourceMappingURL=marketplace.js.map