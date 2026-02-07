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

interface BlockstreamTx {
  txid: string;
  vin: { prevout?: { scriptpubkey_address?: string; value?: number } }[];
  vout: { scriptpubkey_address?: string; value?: number }[];
  status?: { block_height?: number; block_time?: number };
  fee?: number;
}

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export class BitcoinService {
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

        const url = `${this.baseUrl}/address/${address}/txs`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Blockstream API error: ${response.status}`);
        }

        const payload = (await response.json()) as BlockstreamTx[];
        const items = payload.slice(offset, offset + limit);
        const transactions: Transaction[] = items.map((tx) => ({
          hash: tx.txid,
          from: tx.vin?.[0]?.prevout?.scriptpubkey_address ?? "",
          to: tx.vout?.[0]?.scriptpubkey_address ?? null,
          value: `${tx.vout?.[0]?.value ?? 0}`,
          timestamp: tx.status?.block_time ?? 0,
          blockNumber: tx.status?.block_height ?? 0,
          fee: `${tx.fee ?? 0}`,
          status: tx.status?.block_height ? "success" : "pending"
        }));

        const result = {
          transactions,
          total: payload.length
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
