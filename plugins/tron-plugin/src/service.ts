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

interface TronTx {
  txID: string;
  raw_data: {
    contract: Array<{
      parameter: {
        value: {
          owner_address?: string;
          to_address?: string;
          amount?: number;
        };
      };
    }>;
    timestamp?: number;
  };
  ret?: Array<{ contractRet?: string }>;
  blockNumber?: number;
}

interface TronResponse {
  data?: TronTx[];
  total?: number;
}

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export class TronService {
  private cache = new Map<string, CacheEntry<unknown>>();
  private maxCacheEntries = 500;

  constructor(
    private apiKey: string | undefined,
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

        const url = `${this.baseUrl}/v1/accounts/${address}/transactions?limit=${limit}&offset=${offset}`;
        const response = await fetch(url, {
          headers: {
            Accept: "application/json",
            ...(this.apiKey ? { "TRON-PRO-API-KEY": this.apiKey } : {})
          }
        });

        if (!response.ok) {
          throw new Error(`TronGrid API error: ${response.status}`);
        }

        const payload = (await response.json()) as TronResponse;
        const transactions: Transaction[] = (payload.data ?? []).map((tx) => {
          const params = tx.raw_data?.contract?.[0]?.parameter?.value ?? {};
          return {
            hash: tx.txID,
            from: params.owner_address ?? address,
            to: params.to_address ?? null,
            value: `${params.amount ?? 0}`,
            timestamp: tx.raw_data?.timestamp ? Math.floor(tx.raw_data.timestamp / 1000) : 0,
            blockNumber: tx.blockNumber ?? 0,
            fee: "0",
            status: tx.ret?.[0]?.contractRet === "SUCCESS" ? "success" : "failed"
          };
        });

        const result = {
          transactions,
          total: payload.total ?? transactions.length
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
