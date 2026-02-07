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

interface SignatureInfo {
  signature: string;
  blockTime: number | null;
  slot: number;
  err: unknown | null;
}

interface RpcResponse<T> {
  result: T;
}

export class SolanaService {
  constructor(
    private rpcUrl: string,
    private name: string,
    private symbol: string,
    private explorer: string
  ) {
    if (!rpcUrl) {
      throw new Error("Helius RPC URL is required");
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
      throw new Error(`Helius RPC error: ${response.status}`);
    }

    const payload = (await response.json()) as RpcResponse<T>;
    return payload.result;
  }

  getTransactions(address: string, limit = 50, offset = 0) {
    return Effect.tryPromise({
      try: async () => {
        const pageSize = Math.max(1, Math.min(100, limit));
        const signatures = await this.rpc<SignatureInfo[]>("getSignaturesForAddress", [
          address,
          { limit: pageSize, before: undefined }
        ]);

        const paged = signatures.slice(offset, offset + pageSize);
        const transactions: Transaction[] = [];

        for (const sig of paged) {
          const tx = await this.rpc<any>("getTransaction", [sig.signature, { encoding: "jsonParsed" }]);
          if (!tx) {
            continue;
          }

          const feeLamports = tx?.meta?.fee ?? 0;
          const preBalances: number[] = tx?.meta?.preBalances ?? [];
          const postBalances: number[] = tx?.meta?.postBalances ?? [];
          const accountKeys: { pubkey: string }[] = tx?.transaction?.message?.accountKeys ?? [];
          const accountIndex = accountKeys.findIndex((key) => key.pubkey === address);

          let value = "0";
          if (accountIndex >= 0) {
            const delta = (postBalances[accountIndex] ?? 0) - (preBalances[accountIndex] ?? 0);
            value = Math.abs(delta).toString();
          }

          const from = accountKeys[0]?.pubkey ?? address;
          const to = accountKeys[1]?.pubkey ?? null;

          transactions.push({
            hash: sig.signature,
            from,
            to,
            value,
            timestamp: sig.blockTime ?? 0,
            blockNumber: sig.slot,
            fee: feeLamports.toString(),
            status: sig.err ? "failed" : "success"
          });
        }

        return {
          transactions,
          total: signatures.length
        };
      },
      catch: (error) => new Error(`Failed to get transactions: ${error}`)
    });
  }

  getChainInfo() {
    return Effect.succeed({
      chainId: 101,
      name: this.name,
      symbol: this.symbol,
      explorer: this.explorer
    });
  }
}
