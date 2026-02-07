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

interface BlockchairTx {
  hash: string;
  time: string;
  block_id: number;
  fee: number | null;
  balance_change: number | null;
}

interface BlockchairResponse {
  data?: Record<
    string,
    {
      transactions?: BlockchairTx[] | string[];
    }
  >;
}

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export class UtxoService {
  private cache = new Map<string, CacheEntry<unknown>>();
  private maxCacheEntries = 500;

  constructor(
    private apiKey: string | undefined,
    private chain: string,
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

        const url = new URL(`${this.baseUrl}/${this.chain}/dashboards/address/${address}`);
        url.searchParams.set("transaction_details", "true");
        url.searchParams.set("limit", String(limit));
        url.searchParams.set("offset", String(offset));
        if (this.apiKey) {
          url.searchParams.set("key", this.apiKey);
        }

        const response = await fetch(url.toString());
        if (!response.ok) {
          throw new Error(`Blockchair API error: ${response.status}`);
        }

        const payload = (await response.json()) as BlockchairResponse;
        const entry = payload.data?.[address];
        const transactionsRaw = entry?.transactions ?? [];
        const transactionsList = Array.isArray(transactionsRaw)
          ? transactionsRaw
          : [];

        const transactions: Transaction[] = transactionsList
          .filter((tx): tx is BlockchairTx => typeof tx === "object" && !!tx)
          .map((tx) => ({
            hash: tx.hash,
            from: "",
            to: null,
            value: `${tx.balance_change ?? 0}`,
            timestamp: Math.floor(new Date(tx.time).getTime() / 1000),
            blockNumber: tx.block_id ?? 0,
            fee: `${tx.fee ?? 0}`,
            status: tx.block_id ? "success" : "pending"
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
