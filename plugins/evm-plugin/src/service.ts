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

interface AlchemyTransfer {
  uniqueId?: string;
  hash: string;
  from: string;
  to: string | null;
  value: number | string | null;
  blockNum: string;
  category?: string;
  rawContract?: {
    value?: string | null;
    decimal?: string | null;
  };
  metadata?: {
    blockTimestamp?: string | null;
  };
}


interface AlchemyResponse {
  result?: {
    transfers?: AlchemyTransfer[];
    pageKey?: string;
  };
}

export class EthereumService {
  private cache = new Map<string, CacheEntry<unknown>>();
  private maxCacheEntries = 500;

  constructor(
    private apiKey: string,
    private chainId: number,
    private name: string,
    private symbol: string,
    private explorer: string,
    private alchemyUrl: string,
    private cacheTtlMs = 30_000
  ) {
    if (!apiKey) {
      throw new Error("API key is required");
    }
    if (!alchemyUrl) {
      throw new Error("Alchemy URL is required");
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

  getTransactions(address: string, limit = 50, offset = 0) {
    return Effect.tryPromise({
      try: async () => {
        const cacheKey = `tx:${address}:${limit}:${offset}`;
        const cached = this.getCache<{ transactions: Transaction[]; total: number }>(cacheKey);
        if (cached) {
          return cached;
        }

        const pageSize = Math.max(1, Math.min(100, limit));
        const alchemyUrl = this.alchemyUrl;

        const maxCount = Math.max(1, Math.min(1000, limit + offset));

        const fetchTransfers = async (direction: "to" | "from") => {
          const body = {
            id: 1,
            jsonrpc: "2.0",
            method: "alchemy_getAssetTransfers",
            params: [
              {
                fromBlock: "0x0",
                toBlock: "latest",
                ...(direction === "to" ? { toAddress: address } : { fromAddress: address }),
                withMetadata: true,
                excludeZeroValue: true,
                maxCount: `0x${maxCount.toString(16)}`,
                category: ["external", "internal", "erc20", "erc721", "erc1155", "specialnft"]
              }
            ]
          };

          const response = await fetch(alchemyUrl, {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
          });

          if (!response.ok) {
            throw new Error(`Alchemy API error: ${response.status}`);
          }

          const payload = (await response.json()) as AlchemyResponse;
          return payload.result?.transfers ?? [];
        };

        const [toTransfers, fromTransfers] = await Promise.all([
          fetchTransfers("to"),
          fetchTransfers("from")
        ]);

        const merged = [...toTransfers, ...fromTransfers];
        const deduped = Array.from(
          new Map(
            merged.map((tx) => [
              tx.uniqueId ?? `${tx.hash}-${tx.blockNum}-${tx.from}-${tx.to}-${tx.category ?? ""}-${tx.rawContract?.value ?? ""}`,
              tx
            ])
          ).values()
        );

        const sliced = deduped.slice(offset, offset + pageSize);

        const transactions: Transaction[] = sliced.map((tx) => {
          const rawValue = tx.rawContract?.value ?? null;
          const rawDecimal = tx.rawContract?.decimal ?? null;
          let normalizedValue: string = `${tx.value ?? "0"}`;

          if (rawValue && rawDecimal) {
            const decimal = rawDecimal.startsWith("0x")
              ? Number.parseInt(rawDecimal, 16)
              : Number.parseInt(rawDecimal, 10);
            const valueBig = BigInt(rawValue);
            const divisor = BigInt(10) ** BigInt(decimal);
            const whole = valueBig / divisor;
            const fraction = valueBig % divisor;
            normalizedValue = fraction === 0n
              ? `${whole}`
              : `${whole}.${fraction.toString().padStart(decimal, "0")}`;
          }

          return {
            hash: tx.hash,
            from: tx.from,
            to: tx.to ?? null,
            value: normalizedValue,
            timestamp: tx.metadata?.blockTimestamp
              ? Math.floor(new Date(tx.metadata.blockTimestamp).getTime() / 1000)
              : 0,
            blockNumber: parseInt(tx.blockNum, 16),
            fee: "0",
            status: "success"
          };
        });

        const result = {
          transactions,
          total: deduped.length
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
      chainId: this.chainId,
      name: this.name,
      symbol: this.symbol,
      explorer: this.explorer
    };
    this.setCache(cacheKey, info);
    return Effect.succeed(info);
  }
}


