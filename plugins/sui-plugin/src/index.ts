import { createPlugin } from "every-plugin";
import { Effect } from "every-plugin/effect";
import { z } from "every-plugin/zod";
import { contract } from "./contract";
import { SuiService } from "./service";

export default createPlugin({
  contract,

  variables: z.object({
    rpcUrl: z.string().optional(),
    name: z.string().optional(),
    symbol: z.string().optional(),
    explorer: z.string().optional(),
    cacheTtlMs: z.number().optional()
  }),

  secrets: z.object({}),

  initialize: (config) =>
    Effect.gen(function* () {
      const service = new SuiService(
        config.variables.rpcUrl ?? "https://api.mainnet.sui.io",
        config.variables.name ?? "Sui",
        config.variables.symbol ?? "SUI",
        config.variables.explorer ?? "https://suiexplorer.com",
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
      return await Effect.runPromise(context.service.getChainInfo());
    })
  })
});
