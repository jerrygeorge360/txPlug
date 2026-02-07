import type { PluginConfigInput } from "every-plugin";
import type { default as BittensorPlugin } from "./src/index";

export default {
  port: 3030,
  config: {
    variables: {
      name: "Bittensor",
      symbol: "TAO",
      explorer: "https://taostats.io",
      rpcUrl: "https://archive.chain.opentensor.ai"
    }
  } satisfies PluginConfigInput<typeof BittensorPlugin>
};
