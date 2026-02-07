import { createPlugin } from "every-plugin";
import { Effect } from "every-plugin/effect";
import { z } from "every-plugin/zod";
import { contract } from "./contract";
import { ChainService } from "./service";

export default createPlugin({
  contract,

  variables: z.object({
    name: z.string().optional(),
    symbol: z.string().optional(),
    explorer: z.string().optional(),
    baseUrl: z.string().optional()
  }),

  secrets: z.object({
    apiKey: z.string().optional()
  }),

  initialize: (config) =>
    Effect.gen(function* () {
      const service = new ChainService(config.variables.baseUrl ?? "https://api.example.com");
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
