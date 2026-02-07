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

interface BlockstreamTx {
  txid: string;
  vin: { prevout?: { scriptpubkey_address?: string; value?: number } }[];
  vout: { scriptpubkey_address?: string; value?: number }[];
  status?: { block_height?: number; block_time?: number };
  fee?: number;
}

export class BitcoinService {
  constructor(
    private name: string,
    private symbol: string,
    private explorer: string,
    private baseUrl: string
  ) {}

  getTransactions(address: string, limit = 50, offset = 0) {
    return Effect.tryPromise({
      try: async () => {
        const url = `${this.baseUrl}/address/${address}/txs`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Blockstream API error: ${response.status}`);
        }

        const payload = (await response.json()) as BlockstreamTx[];
        const items = payload.slice(offset, offset + limit);
        const transactions: Transaction[] = items.map((tx) => ({
          hash: tx.txid,
          from: tx.vin?.[0]?.prevout?.scriptpubkey_address ?? "",
          to: tx.vout?.[0]?.scriptpubkey_address ?? null,
          value: `${tx.vout?.[0]?.value ?? 0}`,
          timestamp: tx.status?.block_time ?? 0,
          blockNumber: tx.status?.block_height ?? 0,
          fee: `${tx.fee ?? 0}`,
          status: tx.status?.block_height ? "success" : "pending"
        }));

        return {
          transactions,
          total: payload.length
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
