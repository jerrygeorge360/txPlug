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

interface SuiQueryResponse {
  result?: {
    data?: Array<{
      digest: string;
      timestampMs?: string;
      checkpoint?: string;
      transaction?: {
        data?: {
          sender?: string;
        };
      };
    }>;
  };
}

export class SuiService {
  constructor(
    private rpcUrl: string,
    private name: string,
    private symbol: string,
    private explorer: string
  ) {
    if (!rpcUrl) {
      throw new Error("Sui RPC URL is required");
    }
  }

  private async rpc<T>(method: string, params: unknown[]): Promise<T> {
    const response = await fetch(this.rpcUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        id: 1,
        jsonrpc: "2.0",
        method,
        params
      })
    });

    if (!response.ok) {
      throw new Error(`Sui RPC error: ${response.status}`);
    }

    return (await response.json()) as T;
  }

  getTransactions(address: string, limit = 50, offset = 0) {
    return Effect.tryPromise({
      try: async () => {
        const response = await this.rpc<SuiQueryResponse>("suix_queryTransactionBlocks", [
          {
            filter: { Address: address },
            options: { showInput: true },
            limit: Math.max(1, Math.min(100, limit)),
            cursor: null
          }
        ]);

        const data = response.result?.data ?? [];
        const slice = data.slice(offset, offset + limit);
        const transactions: Transaction[] = slice.map((tx) => ({
          hash: tx.digest,
          from: tx.transaction?.data?.sender ?? address,
          to: null,
          value: "0",
          timestamp: tx.timestampMs ? Math.floor(Number(tx.timestampMs) / 1000) : 0,
          blockNumber: tx.checkpoint ? Number(tx.checkpoint) : 0,
          fee: "0",
          status: "success"
        }));

        return {
          transactions,
          total: data.length
        };
      },
      catch: (error) => new Error(`Failed to get transactions: ${error}`)
    });
  }

  getChainInfo() {
    return Effect.succeed({
      chainId: 1,
      name: this.name,
      symbol: this.symbol,
      explorer: this.explorer
    });
  }
}
