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

interface SubscanTransfer {
  hash: string;
  from: string;
  to: string | null;
  amount: string;
  block_timestamp: number;
  block_num: number;
  success: boolean;
  fee: string | null;
}

interface SubscanResponse {
  code: number;
  message?: string;
  data?: {
    count?: number;
    transfers?: SubscanTransfer[];
  };
}

export class PolkadotService {
  constructor(
    private apiKey: string | undefined,
    private network: "polkadot" | "moonbeam",
    private name: string,
    private symbol: string,
    private explorer: string,
    private baseUrl: string
  ) {}

  private getApiUrl() {
    if (this.baseUrl) {
      return this.baseUrl;
    }
    return `https://${this.network}.api.subscan.io`;
  }

  getTransactions(address: string, limit = 50, offset = 0) {
    return Effect.tryPromise({
      try: async () => {
        const pageSize = Math.max(1, Math.min(100, limit));
        const page = Math.floor(offset / pageSize);
        const url = `${this.getApiUrl()}/api/scan/transfers`;

        const response = await fetch(url, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            ...(this.apiKey ? { "X-API-Key": this.apiKey } : {})
          },
          body: JSON.stringify({
            address,
            row: pageSize,
            page,
            direction: "all"
          })
        });

        if (!response.ok) {
          throw new Error(`Subscan API error: ${response.status}`);
        }

        const payload = (await response.json()) as SubscanResponse;
        if (payload.code !== 0) {
          throw new Error(payload.message || "Subscan API error");
        }

        const transfers = payload.data?.transfers ?? [];
        const transactions: Transaction[] = transfers.map((tx) => ({
          hash: tx.hash,
          from: tx.from,
          to: tx.to ?? null,
          value: tx.amount ?? "0",
          timestamp: tx.block_timestamp ?? 0,
          blockNumber: tx.block_num ?? 0,
          fee: tx.fee ?? "0",
          status: tx.success ? "success" : "failed"
        }));

        return {
          transactions,
          total: payload.data?.count ?? transactions.length
        };
      },
      catch: (error) => new Error(`Failed to get transactions: ${error}`)
    });
  }

  getChainInfo() {
    return Effect.succeed({
      chainId: this.network === "moonbeam" ? 1284 : 0,
      name: this.name,
      symbol: this.symbol,
      explorer: this.explorer
    });
  }
}
