import { Effect } from "every-plugin/effect";
import { formatUnits } from "viem";

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

  private toNumber(value: unknown): number | null {
    if (typeof value === "number") return value;
    if (typeof value === "bigint") return Number(value);
    if (typeof value === "string") {
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) return parsed;
      const dateParsed = Date.parse(value);
      return Number.isNaN(dateParsed) ? null : dateParsed;
    }
    return null;
  }

  private toHexNumber(value: unknown): number | null {
    if (typeof value === "bigint") return Number(value);
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.startsWith("0x") || trimmed.startsWith("0X")) {
        return Number.parseInt(trimmed, 16);
      }
      const parsed = Number(trimmed);
      return Number.isNaN(parsed) ? null : parsed;
    }
    return null;
  }


  getTransactions(address: string, limit = 50, offset = 0) {
    return Effect.tryPromise({
      try: async () => {
        const safeLimit = this.toNumber(limit) ?? 50;
        const safeOffset = this.toNumber(offset) ?? 0;
        const cacheKey = `tx:${address}:${limit}:${offset}`;
        const cached = this.getCache<{ transactions: Transaction[]; total: number }>(cacheKey);
        if (cached) {
          return cached;
        }

        const pageSize = Math.max(1, Math.min(100, safeLimit));
        const alchemyUrl = this.alchemyUrl;

        const maxCount = Math.max(1, Math.min(1000, safeLimit + safeOffset));

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

        const sliced = deduped.slice(safeOffset, safeOffset + pageSize);

        const transactions: Transaction[] = sliced.map((tx) => {
          const rawValue = tx.rawContract?.value ?? null;
          const rawDecimal = tx.rawContract?.decimal ?? null;
          let normalizedValue: string = `${tx.value ?? "0"}`;

          if (rawValue && rawDecimal) {
            const rawDecimalString = typeof (rawDecimal as unknown) === "bigint"
              ? String(rawDecimal)
              : String(rawDecimal as unknown);
            const decimal = rawDecimalString.startsWith("0x")
              ? Number.parseInt(rawDecimalString, 16)
              : Number.parseInt(rawDecimalString, 10);
            const valueBig = typeof (rawValue as unknown) === "bigint"
              ? (rawValue as unknown as bigint)
              : BigInt(rawValue as string);
            normalizedValue = formatUnits(valueBig, decimal);
          }

          return {
            hash: tx.hash,
            from: tx.from,
            to: tx.to ?? null,
            value: normalizedValue,
            timestamp: (() => {
              const rawTimestamp = tx.metadata?.blockTimestamp ?? null;
              if (rawTimestamp === null || rawTimestamp === undefined) return 0;
              if (typeof rawTimestamp === "string") {
                const millis = Date.parse(rawTimestamp);
                return Number.isNaN(millis) ? 0 : Math.floor(millis / 1000);
              }
              const numeric = this.toNumber(rawTimestamp);
              if (numeric === null) return 0;
              return numeric > 1e12 ? Math.floor(numeric / 1000) : Math.floor(numeric);
            })(),
            blockNumber: this.toHexNumber(tx.blockNum) ?? 0,
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


