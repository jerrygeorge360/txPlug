import { createPlugin } from "every-plugin";
import { Effect } from "every-plugin/effect";
import { z } from "every-plugin/zod";
import { contract } from "./contract";
import { UtxoService } from "./service";

export default createPlugin({
  contract,

  variables: z.object({
    chain: z.string().optional(),
    name: z.string().optional(),
    symbol: z.string().optional(),
    explorer: z.string().optional(),
    baseUrl: z.string().optional(),
    cacheTtlMs: z.number().optional()
  }),

  secrets: z.object({
    apiKey: z.string().optional()
  }),

  initialize: (config) =>
    Effect.gen(function* () {
      const service = new UtxoService(
        config.secrets.apiKey,
        config.variables.chain ?? "bitcoin",
        config.variables.name ?? "Bitcoin",
        config.variables.symbol ?? "BTC",
        config.variables.explorer ?? "https://blockchair.com/bitcoin",
        config.variables.baseUrl ?? "https://api.blockchair.com",
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
