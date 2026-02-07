import type { PluginConfigInput } from "every-plugin";
import type { default as TronPlugin } from "./src/index";

export default {
  port: 3029,
  config: {
    variables: {
      name: "Tron",
      symbol: "TRX",
      explorer: "https://tronscan.org",
      baseUrl: "https://api.trongrid.io"
    },
    secrets: {
      apiKey: process.env.TRONGRID_API_KEY
    }
  } satisfies PluginConfigInput<typeof TronPlugin>
};
