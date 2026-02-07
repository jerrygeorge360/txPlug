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

interface AptosTx {
  hash: string;
  sender: string;
  success: boolean;
  gas_used: string | number;
  version: string | number;
  timestamp: string | number;
}

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export class AptosService {
  private cache = new Map<string, CacheEntry<unknown>>();
  private maxCacheEntries = 500;

  constructor(
    private name: string,
    private symbol: string,
    private explorer: string,
    private baseUrl: string,
    private cacheTtlMs = 30_000
  ) {}

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

  getTransactions(address: string, limit = 50, offset = 0) {
    return Effect.tryPromise({
      try: async () => {
        const cacheKey = `tx:${address}:${limit}:${offset}`;
        const cached = this.getCache<{ transactions: Transaction[]; total: number }>(cacheKey);
        if (cached) {
          return cached;
        }

        const url = `${this.baseUrl}/accounts/${address}/transactions?limit=${limit}&start=${offset}`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Aptos API error: ${response.status}`);
        }

        const payload = (await response.json()) as AptosTx[];
        const transactions: Transaction[] = payload.map((tx) => ({
          hash: tx.hash,
          from: tx.sender,
          to: null,
          value: "0",
          timestamp: Math.floor(Number(tx.timestamp) / 1_000_000),
          blockNumber: Number(tx.version),
          fee: `${tx.gas_used ?? 0}`,
          status: tx.success ? "success" : "failed"
        }));

        const result = {
          transactions,
          total: transactions.length
        };
        this.setCache(cacheKey, result);
        return result;
      },
      catch: (error) => new Error(`Failed to get transactions: ${error}`)
    });
  }

  getChainInfo() {
    const cacheKey = "chainInfo";
    const cached = this.getCache<{ chainId: number; name: string; symbol: string; explorer: string }>(cacheKey);
    if (cached) {
      return Effect.succeed(cached);
    }
    const info = {
      chainId: 1,
      name: this.name,
      symbol: this.symbol,
      explorer: this.explorer
    };
    this.setCache(cacheKey, info);
    return Effect.succeed(info);
  }
}
