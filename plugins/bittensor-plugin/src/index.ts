import { createPlugin } from "every-plugin";
import { Effect } from "every-plugin/effect";
import { z } from "every-plugin/zod";
import { contract } from "./contract";
import { BittensorService } from "./service";

export default createPlugin({
  contract,

  variables: z.object({
    rpcUrl: z.string().optional(),
    name: z.string().optional(),
    symbol: z.string().optional(),
    explorer: z.string().optional()
  }),

  secrets: z.object({}),

  initialize: (config) =>
    Effect.gen(function* () {
      const service = new BittensorService(
        config.variables.rpcUrl ?? "https://archive.chain.opentensor.ai",
        config.variables.name ?? "Bittensor",
        config.variables.symbol ?? "TAO",
        config.variables.explorer ?? "https://taostats.io"
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
