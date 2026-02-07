import type { PluginConfigInput } from "every-plugin";
import type { default as BitcoinPlugin } from "./src/index";

export default {
  port: 3022,
  config: {
    variables: {
      name: "Bitcoin",
      symbol: "BTC",
      explorer: "https://blockstream.info",
      baseUrl: "https://blockstream.info/api"
    }
  } satisfies PluginConfigInput<typeof BitcoinPlugin>
};
