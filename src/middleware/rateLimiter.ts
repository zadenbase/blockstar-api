import rateLimit from 'express-rate-limit';

// Global rate limiter (all endpoints)
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health';
  }
});

// Strict rate limiter (for auth endpoints)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per windowMs (prevent brute force)
  message: 'Too many auth attempts, please try again later.',
  skipSuccessfulRequests: true // Don't count successful requests
});

// Marketplace limiter (allow more since it's heavily used)
export const marketplaceLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: 'Too many marketplace requests, please try again later.'
});

// Purchase limiter (prevent spam purchases)
export const purchaseLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 5, // 5 purchases per minute
  message: 'Too many purchase attempts, please try again later.',
  skipSuccessfulRequests: false
});

// Extraction limiter (prevent extraction spam)
export const extractionLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // 10 extraction attempts per minute
  message: 'Too many extraction attempts, please try again later.'
});
