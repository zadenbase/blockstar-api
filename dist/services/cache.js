"use strict";
// In-memory cache service (no Redis needed for MVP)
// Fly.io free tier doesn't include Redis, so we use local memory
Object.defineProperty(exports, "__esModule", { value: true });
exports.cache = void 0;
class CacheService {
    constructor() {
        this.cache = new Map();
    }
    set(key, data, ttlSeconds) {
        this.cache.set(key, {
            data,
            expiresAt: Date.now() + ttlSeconds * 1000
        });
    }
    get(key) {
        const entry = this.cache.get(key);
        if (!entry)
            return null;
        // Check if expired
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return null;
        }
        return entry.data;
    }
    delete(key) {
        this.cache.delete(key);
    }
    clear() {
        this.cache.clear();
    }
    // Clean up expired entries every 5 minutes
    startCleanup() {
        setInterval(() => {
            let deleted = 0;
            for (const [key, entry] of this.cache.entries()) {
                if (Date.now() > entry.expiresAt) {
                    this.cache.delete(key);
                    deleted++;
                }
            }
            if (deleted > 0) {
                console.log(`[Cache] Cleaned up ${deleted} expired entries`);
            }
        }, 5 * 60 * 1000);
    }
    getStats() {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }
}
exports.cache = new CacheService();
//# sourceMappingURL=cache.js.map