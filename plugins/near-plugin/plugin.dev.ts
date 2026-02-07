import type { PluginConfigInput } from "every-plugin";
import type { default as NearPlugin } from "./src/index";

export default {
  port: 3025,
  config: {
    variables: {
      provider: "nearblocks",
      name: "NEAR",
      symbol: "NEAR",
      explorer: "https://nearblocks.io",
      baseUrl: "https://api.nearblocks.io",
      covalentBaseUrl: "https://api.covalenthq.com",
      covalentChain: "near-mainnet"
    },
    secrets: {
      apiKey: process.env.COVALENT_API_KEY
    }
  } satisfies PluginConfigInput<typeof NearPlugin>
};
