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
    const rawAlchemyUrl = config.variables.alchemyUrl?.trim();
    const apiKey = config.secrets.apiKey;
    let alchemyUrl = `https://eth-mainnet.g.alchemy.com/v2/${apiKey}`;

    if (rawAlchemyUrl) {
      if (rawAlchemyUrl.includes("${API_KEY}")) {
        alchemyUrl = rawAlchemyUrl.replace("${API_KEY}", apiKey);
      } else if (rawAlchemyUrl.includes("{API_KEY}")) {
        alchemyUrl = rawAlchemyUrl.replace("{API_KEY}", apiKey);
      } else if (rawAlchemyUrl.endsWith("/")) {
        alchemyUrl = `${rawAlchemyUrl}${apiKey}`;
      } else if (rawAlchemyUrl.endsWith("/v2")) {
        alchemyUrl = `${rawAlchemyUrl}/${apiKey}`;
      } else if (rawAlchemyUrl.includes("/v2/")) {
        alchemyUrl = rawAlchemyUrl;
      } else {
        alchemyUrl = `${rawAlchemyUrl}/v2/${apiKey}`;
      }
    }
    const service = new EthereumService(
      apiKey,
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