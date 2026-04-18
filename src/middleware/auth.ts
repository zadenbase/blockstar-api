import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      walletAddress?: string;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';

export function generateToken(walletAddress: string): string {
  return jwt.sign(
    { walletAddress, iat: Math.floor(Date.now() / 1000) },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

export function verifyToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    throw new AppError(401, 'Invalid or expired token');
  }
}

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError(401, 'Missing authorization header'));
  }

  const token = authHeader.substring(7);

  try {
    const payload = verifyToken(token);
    req.walletAddress = payload.walletAddress;
    req.userId = payload.walletAddress;
    next();
  } catch (error) {
    next(error);
  }
};

export const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7);
      const payload = verifyToken(token);
      req.walletAddress = payload.walletAddress;
      req.userId = payload.walletAddress;
    } catch {
      // Ignore auth errors for optional auth
    }
  }

  next();
};
