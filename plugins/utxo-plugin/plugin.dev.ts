import type { PluginConfigInput } from "every-plugin";
import type { default as UtxoPlugin } from "./src/index";

export default {
  port: 3023,
  config: {
    variables: {
      chain: "bitcoin",
      name: "Bitcoin",
      symbol: "BTC",
      explorer: "https://blockchair.com/bitcoin",
      baseUrl: "https://api.blockchair.com"
    },
    secrets: {
      apiKey: process.env.BLOCKCHAIR_API_KEY
    }
  } satisfies PluginConfigInput<typeof UtxoPlugin>
};
