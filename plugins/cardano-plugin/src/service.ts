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

interface BlockfrostTxRef {
  tx_hash: string;
  block_height: number;
  block_time: number;
}

interface BlockfrostTx {
  hash: string;
  block_height: number;
  block_time: number;
  fees: string;
}

export class CardanoService {
  constructor(
    private apiKey: string,
    private name: string,
    private symbol: string,
    private explorer: string,
    private baseUrl: string
  ) {
    if (!apiKey) {
      throw new Error("Blockfrost API key is required");
    }
  }

  private async api<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        project_id: this.apiKey
      }
    });
    if (!response.ok) {
      throw new Error(`Blockfrost API error: ${response.status}`);
    }
    return (await response.json()) as T;
  }

  getTransactions(address: string, limit = 50, offset = 0) {
    return Effect.tryPromise({
      try: async () => {
        const page = Math.floor(offset / Math.max(1, limit)) + 1;
        const refs = await this.api<BlockfrostTxRef[]>(
          `/addresses/${address}/transactions?order=desc&count=${limit}&page=${page}`
        );

        const transactions: Transaction[] = [];
        for (const ref of refs) {
          const tx = await this.api<BlockfrostTx>(`/txs/${ref.tx_hash}`);
          transactions.push({
            hash: tx.hash,
            from: address,
            to: null,
            value: "0",
            timestamp: tx.block_time,
            blockNumber: tx.block_height,
            fee: tx.fees,
            status: "success"
          });
        }

        return {
          transactions,
          total: refs.length
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
