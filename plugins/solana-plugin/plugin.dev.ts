import type { PluginConfigInput } from "every-plugin";
import type { default as SolanaPlugin } from "./src/index";

export default {
  port: 3020,
  config: {
    variables: {
      name: "Solana Mainnet",
      symbol: "SOL",
      explorer: "https://explorer.solana.com",
      rpcUrl: "https://mainnet.helius-rpc.com/?api-key=YOUR_HELIUS_KEY"
    },
    secrets: {
      apiKey: process.env.HELIUS_API_KEY
    }
  } satisfies PluginConfigInput<typeof SolanaPlugin>
};
