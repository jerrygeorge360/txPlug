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
  constructor(
    private provider: "nearblocks" | "covalent",
    private name: string,
    private symbol: string,
    private explorer: string,
    private baseUrl: string,
    private apiKey?: string,
    private covalentBaseUrl?: string,
    private covalentChain?: string
  ) {}

  getTransactions(address: string, limit = 50, offset = 0) {
    return Effect.tryPromise({
      try: async () => {
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

          return {
            transactions,
            total: covalentPayload.data?.pagination?.total_count ?? transactions.length
          };
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

        return {
          transactions,
          total: payload.total ?? transactions.length
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
