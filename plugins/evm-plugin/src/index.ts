import { createPlugin } from "every-plugin";
import { Effect } from "every-plugin/effect";
import { z } from "every-plugin/zod";
import { contract } from "./contract";
import { EthereumService } from "./service";

export default createPlugin({
  contract,
  
  variables: z.object({
    chainId: z.number().optional(),
    name: z.string().optional(),
    symbol: z.string().optional(),
    explorer: z.string().optional(),
    alchemyUrl: z.string().optional(),
    cacheTtlMs: z.number().optional()
  }),
  
  secrets: z.object({ 
    apiKey: z.string() 
  }),
  
  initialize: (config) => Effect.gen(function* () {
    const alchemyUrl = config.variables.alchemyUrl
      ?? `https://eth-mainnet.g.alchemy.com/v2/${config.secrets.apiKey}`;

    const service = new EthereumService(
      config.secrets.apiKey,
      config.variables.chainId ?? 1,
      config.variables.name ?? "Ethereum Mainnet",
      config.variables.symbol ?? "ETH",
      config.variables.explorer ?? "https://etherscan.io",
      alchemyUrl,
      config.variables.cacheTtlMs ?? 30_000
    );
    return { service };
  }),
  
  createRouter: (context, builder) => ({


    getTransactions: builder.getTransactions.handler(async ({ input }) => {
      return await Effect.runPromise(
        context.service.getTransactions(input.address, input.limit, input.offset)
      );
    }),

    getChainInfo: builder.getChainInfo.handler(async () => {
      return await Effect.runPromise(
        context.service.getChainInfo()
      );
    }),

  })
}); 