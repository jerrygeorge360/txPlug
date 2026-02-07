import { createPlugin } from "every-plugin";
import { Effect } from "every-plugin/effect";
import { z } from "every-plugin/zod";
import { contract } from "./contract";
import { TezosService } from "./service";

export default createPlugin({
  contract,

  variables: z.object({
    name: z.string().optional(),
    symbol: z.string().optional(),
    explorer: z.string().optional(),
    baseUrl: z.string().optional(),
    cacheTtlMs: z.number().optional()
  }),

  secrets: z.object({}),

  initialize: (config) =>
    Effect.gen(function* () {
      const service = new TezosService(
        config.variables.name ?? "Tezos",
        config.variables.symbol ?? "XTZ",
        config.variables.explorer ?? "https://tzkt.io",
        config.variables.baseUrl ?? "https://api.tzkt.io/v1",
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
