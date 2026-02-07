import { Effect } from "every-plugin/effect";

interface Transaction {
  hash: string;
  from: string;
  to: string | null;
  value: string;
  timestamp: number;
  blockNumber: number;
  fee: string;
  status: "success" | "failed" | "pending";
}

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export class BittensorService {
  private cache = new Map<string, CacheEntry<unknown>>();
  private maxCacheEntries = 500;

  constructor(
    private rpcUrl: string,
    private name: string,
    private symbol: string,
    private explorer: string,
    private cacheTtlMs = 30_000
  ) {
    if (!rpcUrl) {
      throw new Error("Subtensor RPC URL is required");
    }
  }

  private getCache<T>(key: string): T | undefined {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value;
  }

  private setCache<T>(key: string, value: T) {
    if (this.cache.size >= this.maxCacheEntries) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, { value, expiresAt: Date.now() + this.cacheTtlMs });
  }

  getTransactions(_address: string, _limit = 50, _offset = 0) {
    const cacheKey = "tx:empty";
    const cached = this.getCache<{ transactions: Transaction[]; total: number }>(cacheKey);
    if (cached) {
      return Effect.succeed(cached);
    }
    const result = {
      transactions: [] as Transaction[],
      total: 0
    };
    this.setCache(cacheKey, result);
    return Effect.succeed(result);
  }

  getChainInfo() {
    const cacheKey = "chainInfo";
    const cached = this.getCache<{ chainId: number; name: string; symbol: string; explorer: string }>(cacheKey);
    if (cached) {
      return Effect.succeed(cached);
    }
    const info = {
      chainId: 0,
      name: this.name,
      symbol: this.symbol,
      explorer: this.explorer
    };
    this.setCache(cacheKey, info);
    return Effect.succeed(info);
  }
}
