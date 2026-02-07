import { createPlugin } from "every-plugin";
import { Effect } from "every-plugin/effect";
import { z } from "every-plugin/zod";
import { contract } from "./contract";
import { NearService } from "./service";

export default createPlugin({
  contract,

  variables: z.object({
    provider: z.enum(["nearblocks", "covalent"]).optional(),
    name: z.string().optional(),
    symbol: z.string().optional(),
    explorer: z.string().optional(),
    baseUrl: z.string().optional(),
    covalentBaseUrl: z.string().optional(),
    covalentChain: z.string().optional(),
    cacheTtlMs: z.number().optional()
  }),

  secrets: z.object({
    apiKey: z.string().optional()
  }),

  initialize: (config) =>
    Effect.gen(function* () {
      const service = new NearService(
        config.variables.provider ?? "nearblocks",
        config.variables.name ?? "NEAR",
        config.variables.symbol ?? "NEAR",
        config.variables.explorer ?? "https://nearblocks.io",
        config.variables.baseUrl ?? "https://api.nearblocks.io",
        config.secrets.apiKey,
        config.variables.covalentBaseUrl,
        config.variables.covalentChain,
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
