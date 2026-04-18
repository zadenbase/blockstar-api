import { Router, Request, Response } from 'express';
import { ethers } from 'ethers';
import { supabase } from '../services/supabase';
import { generateToken } from '../middleware/auth';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { authLimiter } from '../middleware/rateLimiter';

const router = Router();

const MESSAGE = 'Sign this message to connect to Blockstar';

function verifySignature(address: string, signature: string): boolean {
  try {
    const recovered = ethers.verifyMessage(MESSAGE, signature);
    return recovered.toLowerCase() === address.toLowerCase();
  } catch {
    return false;
  }
}

// POST /auth/verify
router.post(
  '/verify',
  authLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { walletAddress, signature } = req.body;

    if (!walletAddress || !signature) {
      throw new AppError(400, 'Missing walletAddress or signature');
    }

    if (!walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      throw new AppError(400, 'Invalid wallet address');
    }

    // Verify signature
    if (!verifySignature(walletAddress, signature)) {
      throw new AppError(401, 'Invalid signature');
    }

    // Get or create user
    const user = await supabase.getOrCreateUser(walletAddress);

    // Generate token
    const token = generateToken(walletAddress);
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
  })
);

// POST /auth/qr
router.post(
  '/qr',
  asyncHandler(async (req: Request, res: Response) => {
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
  })
);

export default router;
