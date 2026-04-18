import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabase';
import { cache } from '../services/cache';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { optionalAuth } from '../middleware/auth';
import { marketplaceLimiter } from '../middleware/rateLimiter';

const router = Router();

// GET /marketplace/listings
router.get(
  '/listings',
  marketplaceLimiter,
  optionalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, parseInt(req.query.limit as string) || 10);
    const riskTier = req.query.riskTier as string;
    const region = req.query.region as string;

    // Cache key: include filters
    const cacheKey = `marketplace:page=${page}:limit=${limit}:risk=${riskTier || 'all'}:region=${region || 'all'}`;

    // Check cache first (5 min TTL)
    let result = cache.get<any>(cacheKey);
    if (result) {
      res.json({
        success: true,
        data: { ...result, cached: true },
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Not cached, fetch from DB
    const { listings, agents, total } = await supabase.getMarketplaceListings(page, limit, {
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
    cache.set(cacheKey, data, 300);

    res.json({
      success: true,
      data,
      timestamp: new Date().toISOString()
    });
  })
);

// GET /marketplace/agents/:id
router.get(
  '/agents/:id',
  optionalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const agent = await supabase.getAgentProfile(req.params.id);

    if (!agent) {
      throw new AppError(404, 'Agent not found');
    }

    res.json({
      success: true,
      data: agent,
      timestamp: new Date().toISOString()
    });
  })
);

export default router;
