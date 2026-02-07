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

export class ChainService {
  constructor(private baseUrl: string) {}

  getTransactions(_address: string, _limit = 50, _offset = 0) {
    return Effect.succeed({
      transactions: [] as Transaction[],
      total: 0
    });
  }

  getChainInfo() {
    return Effect.succeed({
      chainId: 0,
      name: "Chain Name",
      symbol: "SYM",
      explorer: "https://explorer.example.com"
    });
  }
}
