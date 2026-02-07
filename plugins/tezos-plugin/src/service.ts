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

interface TzktOp {
  hash: string;
  sender?: { address: string };
  target?: { address: string } | null;
  amount?: number;
  timestamp?: string;
  level?: number;
  status?: string;
  fee?: number;
}

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export class TezosService {
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

        const url = `${this.baseUrl}/accounts/${address}/operations?limit=${limit}&offset=${offset}`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`TzKT API error: ${response.status}`);
        }

        const payload = (await response.json()) as TzktOp[];
        const transactions: Transaction[] = payload.map((op) => ({
          hash: op.hash,
          from: op.sender?.address ?? address,
          to: op.target?.address ?? null,
          value: `${op.amount ?? 0}`,
          timestamp: op.timestamp ? Math.floor(new Date(op.timestamp).getTime() / 1000) : 0,
          blockNumber: op.level ?? 0,
          fee: `${op.fee ?? 0}`,
          status: op.status === "applied" ? "success" : "failed"
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
      chainId: 0,
      name: this.name,
      symbol: this.symbol,
      explorer: this.explorer
    };
    this.setCache(cacheKey, info);
    return Effect.succeed(info);
  }
}
