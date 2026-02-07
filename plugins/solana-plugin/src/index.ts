import { createPlugin } from "every-plugin";
import { Effect } from "every-plugin/effect";
import { z } from "every-plugin/zod";
import { contract } from "./contract";
import { SolanaService } from "./service";

export default createPlugin({
  contract,

  variables: z.object({
    rpcUrl: z.string().optional(),
    name: z.string().optional(),
    symbol: z.string().optional(),
    explorer: z.string().optional()
  }),

  secrets: z.object({
    apiKey: z.string().optional()
  }),

  initialize: (config) =>
    Effect.gen(function* () {
      const rpcUrl =
        config.variables.rpcUrl ??
        (config.secrets.apiKey
          ? `https://mainnet.helius-rpc.com/?api-key=${config.secrets.apiKey}`
          : undefined);

      const service = new SolanaService(
        rpcUrl ?? "",
        config.variables.name ?? "Solana Mainnet",
        config.variables.symbol ?? "SOL",
        config.variables.explorer ?? "https://explorer.solana.com"
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
