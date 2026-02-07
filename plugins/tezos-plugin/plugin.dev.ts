import type { PluginConfigInput } from "every-plugin";
import type { default as TezosPlugin } from "./src/index";

export default {
  port: 3028,
  config: {
    variables: {
      name: "Tezos",
      symbol: "XTZ",
      explorer: "https://tzkt.io",
      baseUrl: "https://api.tzkt.io/v1"
    }
  } satisfies PluginConfigInput<typeof TezosPlugin>
};
