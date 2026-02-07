import type { PluginConfigInput } from "every-plugin";
import type { default as AptosPlugin } from "./src/index";

export default {
  port: 3026,
  config: {
    variables: {
      name: "Aptos",
      symbol: "APT",
      explorer: "https://explorer.aptoslabs.com",
      baseUrl: "https://api.mainnet.aptoslabs.com/v1"
    }
  } satisfies PluginConfigInput<typeof AptosPlugin>
};
