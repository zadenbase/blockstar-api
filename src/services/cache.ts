// In-memory cache service (no Redis needed for MVP)
// Fly.io free tier doesn't include Redis, so we use local memory

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class CacheService {
  private cache = new Map<string, CacheEntry<any>>();

  set<T>(key: string, data: T, ttlSeconds: number): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) return null;

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  // Clean up expired entries every 5 minutes
  startCleanup(): void {
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

  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

export const cache = new CacheService();
