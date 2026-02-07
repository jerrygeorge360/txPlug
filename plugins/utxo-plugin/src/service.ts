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

export class UtxoService {
  constructor(
    private apiKey: string | undefined,
    private chain: string,
    private name: string,
    private symbol: string,
    private explorer: string,
    private baseUrl: string
  ) {}

  getTransactions(address: string, limit = 50, offset = 0) {
    return Effect.tryPromise({
      try: async () => {
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
