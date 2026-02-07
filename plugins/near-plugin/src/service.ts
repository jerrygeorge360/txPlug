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

interface CovalentTransaction {
  tx_hash: string;
  from_address: string;
  to_address: string | null;
  value: string;
  block_signed_at: string;
  block_height: number;
  fees: string | null;
  successful: boolean | null;
}

interface CovalentResponse {
  data: {
    items: CovalentTransaction[];
    pagination?: {
      total_count?: number;
    };
  };
}

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

interface NearblocksResponse {
  txns?: Array<{
    transaction_hash: string;
    predecessor_account_id: string;
    receiver_account_id: string;
    block_timestamp: string;
    block_height: number;
    deposit: string | number;
    status: string;
  }>;
  total?: number;
}

export class NearService {
  private cache = new Map<string, CacheEntry<unknown>>();
  private maxCacheEntries = 500;

  constructor(
    private provider: "nearblocks" | "covalent",
    private name: string,
    private symbol: string,
    private explorer: string,
    private baseUrl: string,
    private apiKey?: string,
    private covalentBaseUrl?: string,
    private covalentChain?: string,
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

        if (this.provider === "covalent") {
          if (!this.apiKey) {
            throw new Error("Covalent API key is required");
          }
          const chain = this.covalentChain ?? "near-mainnet";
          const covalentUrl = new URL(
            `${this.covalentBaseUrl ?? "https://api.covalenthq.com"}/v1/${chain}/address/${address}/transactions_v2/`
          );
          covalentUrl.searchParams.set("key", this.apiKey);
          covalentUrl.searchParams.set("page-number", String(Math.floor(offset / Math.max(1, limit)) + 1));
          covalentUrl.searchParams.set("page-size", String(Math.max(1, Math.min(100, limit))));

          const covalentResponse = await fetch(covalentUrl.toString());
          if (!covalentResponse.ok) {
            throw new Error(`Covalent API error: ${covalentResponse.status}`);
          }
          const covalentPayload = (await covalentResponse.json()) as CovalentResponse;
          const items = covalentPayload.data?.items ?? [];
          const transactions: Transaction[] = items.map((tx) => ({
            hash: tx.tx_hash,
            from: tx.from_address,
            to: tx.to_address,
            value: tx.value ?? "0",
            timestamp: Math.floor(new Date(tx.block_signed_at).getTime() / 1000),
            blockNumber: tx.block_height,
            fee: tx.fees ?? "0",
            status: tx.successful === null ? "pending" : tx.successful ? "success" : "failed"
          }));

          const result = {
            transactions,
            total: covalentPayload.data?.pagination?.total_count ?? transactions.length
          };
          this.setCache(cacheKey, result);
          return result;
        }

        const url = `${this.baseUrl}/v1/account/${address}/txns?limit=${limit}&offset=${offset}`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Nearblocks API error: ${response.status}`);
        }

        const payload = (await response.json()) as NearblocksResponse;
        const txns = payload.txns ?? [];
        const transactions: Transaction[] = txns.map((tx) => ({
          hash: tx.transaction_hash,
          from: tx.predecessor_account_id,
          to: tx.receiver_account_id,
          value: `${tx.deposit ?? 0}`,
          timestamp: Math.floor(Number(tx.block_timestamp) / 1_000_000_000),
          blockNumber: tx.block_height ?? 0,
          fee: "0",
          status: tx.status?.toLowerCase() === "success" ? "success" : "failed"
        }));

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
