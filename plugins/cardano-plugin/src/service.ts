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

interface BlockfrostTxRef {
  tx_hash: string;
  block_height: number;
  block_time: number;
}

interface BlockfrostTx {
  hash: string;
  block_height: number;
  block_time: number;
  fees: string;
}

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export class CardanoService {
  private cache = new Map<string, CacheEntry<unknown>>();
  private maxCacheEntries = 500;

  constructor(
    private apiKey: string,
    private name: string,
    private symbol: string,
    private explorer: string,
    private baseUrl: string,
    private cacheTtlMs = 30_000
  ) {
    if (!apiKey) {
      throw new Error("Blockfrost API key is required");
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

  private async api<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        project_id: this.apiKey
      }
    });
    if (!response.ok) {
      throw new Error(`Blockfrost API error: ${response.status}`);
    }
    return (await response.json()) as T;
  }

  getTransactions(address: string, limit = 50, offset = 0) {
    return Effect.tryPromise({
      try: async () => {
        const cacheKey = `tx:${address}:${limit}:${offset}`;
        const cached = this.getCache<{ transactions: Transaction[]; total: number }>(cacheKey);
        if (cached) {
          return cached;
        }

        const page = Math.floor(offset / Math.max(1, limit)) + 1;
        const refs = await this.api<BlockfrostTxRef[]>(
          `/addresses/${address}/transactions?order=desc&count=${limit}&page=${page}`
        );

        const transactions: Transaction[] = [];
        for (const ref of refs) {
          const tx = await this.api<BlockfrostTx>(`/txs/${ref.tx_hash}`);
          transactions.push({
            hash: tx.hash,
            from: address,
            to: null,
            value: "0",
            timestamp: tx.block_time,
            blockNumber: tx.block_height,
            fee: tx.fees,
            status: "success"
          });
        }

        const result = {
          transactions,
          total: refs.length
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
