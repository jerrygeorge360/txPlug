import type { PluginConfigInput } from 'every-plugin';
import type { default as EthereumPlugin } from './src/index';

export default {
  port: 3014,
  config: {
    variables: { 
    //   network: "sepolia",
    //   rpcUrl: "https://sepolia.infura.io/v3/YOUR_INFURA_KEY",
    //   chainId: 11155111
    },
    secrets: { 
      apiKey: process.env.ETHEREUM_API_KEY || "dev-key",
    //   infuraKey: process.env.INFURA_KEY || "dev-infura-key"
    }
  } satisfies PluginConfigInput<typeof EthereumPlugin>
};