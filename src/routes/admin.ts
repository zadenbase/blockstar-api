import { Router, Request, Response, NextFunction } from 'express';
import { supabase } from '../services/supabase';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { cache } from '../services/cache';

const router = Router();

function adminAuth(req: Request, res: Response, next: NextFunction) {
  const key = req.headers['x-admin-key'];
  const secret = process.env.ADMIN_SECRET;
  if (!secret || key !== secret) throw new AppError(401, 'Invalid admin key');
  next();
}

// GET /admin/users
router.get('/users', adminAuth, asyncHandler(async (req: Request, res: Response) => {
  const users = await supabase.getAllUsers();
  res.json({ success: true, data: users, count: users.length, timestamp: new Date().toISOString() });
}));

// POST /admin/credit  { walletAddress, amount, note? }
router.post('/credit', adminAuth, asyncHandler(async (req: Request, res: Response) => {
  const { walletAddress, amount, note } = req.body;
  if (!walletAddress || !amount || isNaN(Number(amount)) || Number(amount) <= 0) {
    throw new AppError(400, 'walletAddress and positive amount required');
  }
  const addr = String(walletAddress).toLowerCase();
  const credit = Number(amount);
  const { previous, newBalance } = await supabase.creditBalance(
    addr, 
    credit,
    credit > 0 ? 'admin_credit' : 'admin_debit',
    { note: note || `Admin ${credit > 0 ? 'credit' : 'debit'} of $${Math.abs(credit)}` }
  );
  cache.delete(`balance:${addr}`);
  res.json({
    success: true,
    data: { wallet_address: addr, credited: credit, previous_balance: previous, new_balance: newBalance, note: note ?? null },
    timestamp: new Date().toISOString(),
  });
}));

// POST /admin/set-balance  { walletAddress, amount }
router.post('/set-balance', adminAuth, asyncHandler(async (req: Request, res: Response) => {
  const { walletAddress, amount } = req.body;
  if (!walletAddress || amount === undefined) throw new AppError(400, 'walletAddress and amount required');
  const addr = String(walletAddress).toLowerCase();
  const user = await supabase.setBalance(addr, Number(amount));
  cache.delete(`balance:${addr}`);
  res.json({ success: true, data: user, timestamp: new Date().toISOString() });
}));

export default router;
