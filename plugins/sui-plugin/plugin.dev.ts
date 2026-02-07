import type { PluginConfigInput } from "every-plugin";
import type { default as SuiPlugin } from "./src/index";

export default {
  port: 3027,
  config: {
    variables: {
      name: "Sui",
      symbol: "SUI",
      explorer: "https://suiexplorer.com",
      rpcUrl: "https://api.mainnet.sui.io"
    }
  } satisfies PluginConfigInput<typeof SuiPlugin>
};
