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
    baseUrl: z.string().optional(),
    provider: z.enum(["covalent", "alchemy"]).optional(),
    alchemyUrl: z.string().optional()
  }),
  
  secrets: z.object({ 
    apiKey: z.string() 
  }),
  
  initialize: (config) => Effect.gen(function* () {
    const service = new EthereumService(
      config.secrets.apiKey,
      config.variables.chainId ?? 1,
      config.variables.name ?? "Ethereum Mainnet",
      config.variables.symbol ?? "ETH",
      config.variables.explorer ?? "https://etherscan.io",
      config.variables.baseUrl ?? "https://api.covalenthq.com",
      config.variables.provider ?? "covalent",
      config.variables.alchemyUrl
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