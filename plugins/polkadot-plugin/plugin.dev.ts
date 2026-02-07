import type { PluginConfigInput } from "every-plugin";
import type { default as PolkadotPlugin } from "./src/index";

export default {
  port: 3021,
  config: {
    variables: {
      network: "polkadot",
      name: "Polkadot",
      symbol: "DOT",
      explorer: "https://polkadot.subscan.io",
      baseUrl: "https://polkadot.api.subscan.io"
    },
    secrets: {
      apiKey: process.env.SUBSCAN_API_KEY
    }
  } satisfies PluginConfigInput<typeof PolkadotPlugin>
};
