import type { PluginConfigInput } from "every-plugin";
import type { default as ChainPlugin } from "./src/index";

export default {
  port: 3031,
  config: {
    variables: {
      name: "Chain Name",
      symbol: "SYM",
      explorer: "https://explorer.example.com",
      baseUrl: "https://api.example.com"
    },
    secrets: {
      apiKey: process.env.CHAIN_API_KEY
    }
  } satisfies PluginConfigInput<typeof ChainPlugin>
};
