import express from 'express';
import cors from 'cors';
import compression from 'compression';
import * as dotenv from 'dotenv';
import { errorHandler } from './middleware/errorHandler';
import { globalLimiter } from './middleware/rateLimiter';
import { cache } from './services/cache';
import authRoutes from './routes/auth';
import marketplaceRoutes from './routes/marketplace';
import purchaseRoutes from './routes/purchases';
import extractionRoutes from './routes/extractions';
import balanceRoutes from './routes/balance';
import payoutRoutes from './routes/payouts';
import masterRoutes from './routes/master';
import adminRoutes from './routes/admin';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(compression()); // Compress responses (reduces bandwidth by ~60%)
app.use(
  cors({
    origin: (process.env.ALLOWED_ORIGINS || 'http://localhost:3333').split(','),
    credentials: true
  })
);
app.use(globalLimiter); // Global rate limiting

// Start cache cleanup
cache.startCleanup();

// Health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    data: { status: 'ok' },
    timestamp: new Date().toISOString()
  });
});

// Routes
app.use('/auth', authRoutes);
app.use('/marketplace', marketplaceRoutes);
app.use('/purchases', purchaseRoutes);
app.use('/extractions', extractionRoutes);
app.use('/users', balanceRoutes);
app.use('/payouts', payoutRoutes);
app.use('/master-agent', masterRoutes);
app.use('/admin', adminRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
    timestamp: new Date().toISOString()
  });
});

// Error handler
app.use(errorHandler);

// Start server (only in non-serverless environments)
if (process.env.VERCEL !== '1' && !process.env.VERCEL_ENV) {
  app.listen(PORT, () => {
    console.log(`\n  🔷 Blockstar API running on port ${PORT}`);
    console.log(`  📍 http://localhost:${PORT}`);
    console.log(`  🏥 Health: http://localhost:${PORT}/health`);
    console.log(`  ⚡ Caching enabled (5 min marketplace, 10 sec balance)`);
    console.log(`  🛡️  Rate limiting active`);
    console.log(`  📦 Compression enabled\n`);
  });
}

export default app;
