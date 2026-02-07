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

interface AlchemyTransfer {
  hash: string;
  from: string;
  to: string | null;
  value: number | string;
  blockNum: string;
  metadata?: {
    blockTimestamp?: string;
  };
}

interface AlchemyResponse {
  result?: {
    transfers?: AlchemyTransfer[];
  };
}

export class EthereumService {
  constructor(
    private apiKey: string,
    private chainId: number,
    private name: string,
    private symbol: string,
    private explorer: string,
    private baseUrl: string,
    private provider: "covalent" | "alchemy",
    private alchemyUrl?: string
  ) {
    if (!apiKey) {
      throw new Error("API key is required");
    }
  }

  getTransactions(address: string, limit = 50, offset = 0) {
    return Effect.tryPromise({
      try: async () => {
        const pageSize = Math.max(1, Math.min(100, limit));

        if (this.provider === "alchemy") {
          if (!this.alchemyUrl) {
            throw new Error("Alchemy URL is required when provider=alchemy");
          }

          const body = {
            id: 1,
            jsonrpc: "2.0",
            method: "alchemy_getAssetTransfers",
            params: [
              {
                fromBlock: "0x0",
                toBlock: "latest",
                toAddress: address,
                fromAddress: address,
                withMetadata: true,
                excludeZeroValue: true,
                maxCount: `0x${pageSize.toString(16)}`,
                category: ["external", "internal", "erc20", "erc721", "erc1155"]
              }
            ]
          };

          const response = await fetch(this.alchemyUrl, {
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
          const transfers = payload.result?.transfers ?? [];

          const transactions: Transaction[] = transfers.map((tx) => ({
            hash: tx.hash,
            from: tx.from,
            to: tx.to ?? null,
            value: `${tx.value ?? "0"}`,
            timestamp: tx.metadata?.blockTimestamp
              ? Math.floor(new Date(tx.metadata.blockTimestamp).getTime() / 1000)
              : 0,
            blockNumber: parseInt(tx.blockNum, 16),
            fee: "0",
            status: "success"
          }));

          return {
            transactions,
            total: transactions.length
          };
        }

        const pageNumber = Math.floor(offset / pageSize) + 1;
        const url = new URL(
          `${this.baseUrl}/v1/${this.chainId}/address/${address}/transactions_v2/`
        );
        url.searchParams.set("key", this.apiKey);
        url.searchParams.set("page-number", String(pageNumber));
        url.searchParams.set("page-size", String(pageSize));

        const response = await fetch(url.toString());
        if (!response.ok) {
          throw new Error(`Covalent API error: ${response.status}`);
        }
        const payload = (await response.json()) as CovalentResponse;
        const items = payload.data?.items ?? [];

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
          total: payload.data?.pagination?.total_count ?? transactions.length
        };
      },
      catch: (error) => new Error(`Failed to get transactions: ${error}`)
    });
  }

  getChainInfo() {
    return Effect.succeed({
      chainId: this.chainId,
      name: this.name,
      symbol: this.symbol,
      explorer: this.explorer
    });
  }
}