"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractionLimiter = exports.purchaseLimiter = exports.marketplaceLimiter = exports.authLimiter = exports.globalLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
// Global rate limiter (all endpoints)
exports.globalLimiter = (0, express_rate_limit_1.default)({
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
exports.authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 requests per windowMs (prevent brute force)
    message: 'Too many auth attempts, please try again later.',
    skipSuccessfulRequests: true // Don't count successful requests
});
// Marketplace limiter (allow more since it's heavily used)
exports.marketplaceLimiter = (0, express_rate_limit_1.default)({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30, // 30 requests per minute
    message: 'Too many marketplace requests, please try again later.'
});
// Purchase limiter (prevent spam purchases)
exports.purchaseLimiter = (0, express_rate_limit_1.default)({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 5, // 5 purchases per minute
    message: 'Too many purchase attempts, please try again later.',
    skipSuccessfulRequests: false
});
// Extraction limiter (prevent extraction spam)
exports.extractionLimiter = (0, express_rate_limit_1.default)({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 10, // 10 extraction attempts per minute
    message: 'Too many extraction attempts, please try again later.'
});
//# sourceMappingURL=rateLimiter.js.map