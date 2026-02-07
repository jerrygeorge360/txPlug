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

interface TzktOp {
  hash: string;
  sender?: { address: string };
  target?: { address: string } | null;
  amount?: number;
  timestamp?: string;
  level?: number;
  status?: string;
  fee?: number;
}

export class TezosService {
  constructor(
    private name: string,
    private symbol: string,
    private explorer: string,
    private baseUrl: string
  ) {}

  getTransactions(address: string, limit = 50, offset = 0) {
    return Effect.tryPromise({
      try: async () => {
        const url = `${this.baseUrl}/accounts/${address}/operations?limit=${limit}&offset=${offset}`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`TzKT API error: ${response.status}`);
        }

        const payload = (await response.json()) as TzktOp[];
        const transactions: Transaction[] = payload.map((op) => ({
          hash: op.hash,
          from: op.sender?.address ?? address,
          to: op.target?.address ?? null,
          value: `${op.amount ?? 0}`,
          timestamp: op.timestamp ? Math.floor(new Date(op.timestamp).getTime() / 1000) : 0,
          blockNumber: op.level ?? 0,
          fee: `${op.fee ?? 0}`,
          status: op.status === "applied" ? "success" : "failed"
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
      chainId: 0,
      name: this.name,
      symbol: this.symbol,
      explorer: this.explorer
    });
  }
}
