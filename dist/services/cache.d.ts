declare class CacheService {
    private cache;
    set<T>(key: string, data: T, ttlSeconds: number): void;
    get<T>(key: string): T | null;
    delete(key: string): void;
    clearPattern(prefix: string): void;
    clear(): void;
    startCleanup(): void;
    getStats(): {
        size: number;
        keys: string[];
    };
}
export declare const cache: CacheService;
export {};
