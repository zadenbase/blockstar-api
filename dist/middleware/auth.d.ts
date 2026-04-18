import { Request, Response, NextFunction } from 'express';
declare global {
    namespace Express {
        interface Request {
            userId?: string;
            walletAddress?: string;
        }
    }
}
export declare function generateToken(walletAddress: string): string;
export declare function verifyToken(token: string): any;
export declare const authMiddleware: (req: Request, res: Response, next: NextFunction) => void;
export declare const optionalAuth: (req: Request, res: Response, next: NextFunction) => void;
