import type { PluginConfigInput } from "every-plugin";
import type { default as CardanoPlugin } from "./src/index";

export default {
  port: 3024,
  config: {
    variables: {
      name: "Cardano",
      symbol: "ADA",
      explorer: "https://cardanoscan.io",
      baseUrl: "https://cardano-mainnet.blockfrost.io/api/v0"
    },
    secrets: {
      apiKey: process.env.BLOCKFROST_API_KEY
    }
  } satisfies PluginConfigInput<typeof CardanoPlugin>
};
