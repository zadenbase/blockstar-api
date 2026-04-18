"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionalAuth = exports.authMiddleware = void 0;
exports.generateToken = generateToken;
exports.verifyToken = verifyToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const errorHandler_1 = require("./errorHandler");
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';
function generateToken(walletAddress) {
    return jsonwebtoken_1.default.sign({ walletAddress, iat: Math.floor(Date.now() / 1000) }, JWT_SECRET, { expiresIn: '24h' });
}
function verifyToken(token) {
    try {
        return jsonwebtoken_1.default.verify(token, JWT_SECRET);
    }
    catch {
        throw new errorHandler_1.AppError(401, 'Invalid or expired token');
    }
}
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next(new errorHandler_1.AppError(401, 'Missing authorization header'));
    }
    const token = authHeader.substring(7);
    try {
        const payload = verifyToken(token);
        req.walletAddress = payload.walletAddress;
        req.userId = payload.walletAddress;
        next();
    }
    catch (error) {
        next(error);
    }
};
exports.authMiddleware = authMiddleware;
const optionalAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
            const token = authHeader.substring(7);
            const payload = verifyToken(token);
            req.walletAddress = payload.walletAddress;
            req.userId = payload.walletAddress;
        }
        catch {
            // Ignore auth errors for optional auth
        }
    }
    next();
};
exports.optionalAuth = optionalAuth;
//# sourceMappingURL=auth.js.map