import { createPlugin } from "every-plugin";
import { Effect } from "every-plugin/effect";
import { z } from "every-plugin/zod";
import { contract } from "./contract";
import { AptosService } from "./service";

export default createPlugin({
  contract,

  variables: z.object({
    name: z.string().optional(),
    symbol: z.string().optional(),
    explorer: z.string().optional(),
    baseUrl: z.string().optional()
  }),

  secrets: z.object({}),

  initialize: (config) =>
    Effect.gen(function* () {
      const service = new AptosService(
        config.variables.name ?? "Aptos",
        config.variables.symbol ?? "APT",
        config.variables.explorer ?? "https://explorer.aptoslabs.com",
        config.variables.baseUrl ?? "https://api.mainnet.aptoslabs.com/v1"
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
