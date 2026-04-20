"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractionLimiter = exports.purchaseLimiter = exports.marketplaceLimiter = exports.authLimiter = exports.globalLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
// Get client IP considering proxies (Vercel, Fly.io)
function getClientIp(req) {
    // Vercel/Fly forwarded headers
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    return req.ip || req.connection.remoteAddress || 'unknown';
}
// Check if request is from trusted web app
function isWebApp(req) {
    const origin = req.headers.origin || '';
    const referer = req.headers.referer || '';
    const allowed = [
        'https://blockstar-web.vercel.app',
        'http://localhost:3333',
        'http://localhost:5173',
        'https://blockstar.fun',
        'https://www.blockstar.fun'
    ];
    return allowed.some(url => origin.includes(url) || referer.includes(url));
}
// Global rate limiter (all endpoints) - higher limit for web app
exports.globalLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: (req) => isWebApp(req) ? 1000 : 100, // 1000 for web app, 100 for others
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => getClientIp(req),
    skip: (req) => {
        // Skip rate limiting for health checks
        return req.path === '/health';
    }
});
// Strict rate limiter (for auth endpoints) - more lenient for web app
exports.authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: (req) => isWebApp(req) ? 50 : 10, // 50 for web app, 10 for others
    message: 'Too many auth attempts, please try again later.',
    keyGenerator: (req) => getClientIp(req),
    skipSuccessfulRequests: true // Don't count successful requests
});
// Marketplace limiter - higher for web app
exports.marketplaceLimiter = (0, express_rate_limit_1.default)({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: (req) => isWebApp(req) ? 300 : 30, // 300 for web app, 30 for others
    message: 'Too many marketplace requests, please try again later.',
    keyGenerator: (req) => getClientIp(req)
});
// Purchase limiter (prevent spam purchases)
exports.purchaseLimiter = (0, express_rate_limit_1.default)({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 5, // 5 purchases per minute - same for all
    message: 'Too many purchase attempts, please try again later.',
    keyGenerator: (req) => getClientIp(req),
    skipSuccessfulRequests: false
});
// Extraction limiter (prevent extraction spam)
exports.extractionLimiter = (0, express_rate_limit_1.default)({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: (req) => isWebApp(req) ? 100 : 10, // 100 for web app, 10 for others
    message: 'Too many extraction attempts, please try again later.',
    keyGenerator: (req) => getClientIp(req)
});
//# sourceMappingURL=rateLimiter.js.map