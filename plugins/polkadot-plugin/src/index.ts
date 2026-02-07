import { createPlugin } from "every-plugin";
import { Effect } from "every-plugin/effect";
import { z } from "every-plugin/zod";
import { contract } from "./contract";
import { PolkadotService } from "./service";

export default createPlugin({
  contract,

  variables: z.object({
    network: z.enum(["polkadot", "moonbeam"]).optional(),
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
      const network = config.variables.network ?? "polkadot";
      const service = new PolkadotService(
        config.secrets.apiKey,
        network,
        config.variables.name ?? (network === "moonbeam" ? "Moonbeam" : "Polkadot"),
        config.variables.symbol ?? (network === "moonbeam" ? "GLMR" : "DOT"),
        config.variables.explorer ??
          (network === "moonbeam"
            ? "https://moonbeam.subscan.io"
            : "https://polkadot.subscan.io"),
        config.variables.baseUrl ?? `https://${network}.api.subscan.io`
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
