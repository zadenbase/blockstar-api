"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const compression_1 = __importDefault(require("compression"));
const dotenv = __importStar(require("dotenv"));
const errorHandler_1 = require("./middleware/errorHandler");
const rateLimiter_1 = require("./middleware/rateLimiter");
const cache_1 = require("./services/cache");
const auth_1 = __importDefault(require("./routes/auth"));
const marketplace_1 = __importDefault(require("./routes/marketplace"));
const purchases_1 = __importDefault(require("./routes/purchases"));
const extractions_1 = __importDefault(require("./routes/extractions"));
const balance_1 = __importDefault(require("./routes/balance"));
const payouts_1 = __importDefault(require("./routes/payouts"));
dotenv.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// Middleware
app.use(express_1.default.json());
app.use((0, compression_1.default)()); // Compress responses (reduces bandwidth by ~60%)
app.use((0, cors_1.default)({
    origin: (process.env.ALLOWED_ORIGINS || 'http://localhost:3333').split(','),
    credentials: true
}));
app.use(rateLimiter_1.globalLimiter); // Global rate limiting
// Start cache cleanup
cache_1.cache.startCleanup();
// Health check
app.get('/health', (req, res) => {
    res.json({
        success: true,
        data: { status: 'ok' },
        timestamp: new Date().toISOString()
    });
});
// Routes
app.use('/auth', auth_1.default);
app.use('/marketplace', marketplace_1.default);
app.use('/purchases', purchases_1.default);
app.use('/extractions', extractions_1.default);
app.use('/users', balance_1.default);
app.use('/payouts', payouts_1.default);
// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Not found',
        timestamp: new Date().toISOString()
    });
});
// Error handler
app.use(errorHandler_1.errorHandler);
// Start server
app.listen(PORT, () => {
    console.log(`\n  🔷 Blockstar API running on port ${PORT}`);
    console.log(`  📍 http://localhost:${PORT}`);
    console.log(`  🏥 Health: http://localhost:${PORT}/health`);
    console.log(`  ⚡ Caching enabled (5 min marketplace, 10 sec balance)`);
    console.log(`  🛡️  Rate limiting active`);
    console.log(`  📦 Compression enabled\n`);
});
exports.default = app;
//# sourceMappingURL=server.js.map