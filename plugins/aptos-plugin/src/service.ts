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

interface AptosTx {
  hash: string;
  sender: string;
  success: boolean;
  gas_used: string | number;
  version: string | number;
  timestamp: string | number;
}

export class AptosService {
  constructor(
    private name: string,
    private symbol: string,
    private explorer: string,
    private baseUrl: string
  ) {}

  getTransactions(address: string, limit = 50, offset = 0) {
    return Effect.tryPromise({
      try: async () => {
        const url = `${this.baseUrl}/accounts/${address}/transactions?limit=${limit}&start=${offset}`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Aptos API error: ${response.status}`);
        }

        const payload = (await response.json()) as AptosTx[];
        const transactions: Transaction[] = payload.map((tx) => ({
          hash: tx.hash,
          from: tx.sender,
          to: null,
          value: "0",
          timestamp: Math.floor(Number(tx.timestamp) / 1_000_000),
          blockNumber: Number(tx.version),
          fee: `${tx.gas_used ?? 0}`,
          status: tx.success ? "success" : "failed"
        }));

        return {
          transactions,
          total: transactions.length
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
