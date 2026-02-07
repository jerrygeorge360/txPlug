import { oc } from "every-plugin/orpc";
import { z } from "every-plugin/zod";
import { CommonPluginErrors } from "every-plugin";

export const TransactionSchema = z.object({
  hash: z.string(),
  from: z.string(),
  to: z.string().nullable(),
  value: z.string(),
  timestamp: z.number(),
  blockNumber: z.number(),
  fee: z.string(),
  status: z.enum(["success", "failed", "pending"])
});

export const contract = oc.router({
  getTransactions: oc.route({ method: "POST", path: "/getTransactions" })
    .input(
      z.object({
        address: z.string(),
        limit: z.number().optional(),
        offset: z.number().optional()
      })
    )
    .output(
      z.object({
        transactions: z.array(TransactionSchema),
        total: z.number()
      })
    )
    .errors(CommonPluginErrors),

  getChainInfo: oc.route({ method: "POST", path: "/getChainInfo" })
    .input(z.object({}))
    .output(
      z.object({
        chainId: z.number(),
        name: z.string(),
        symbol: z.string(),
        explorer: z.string()
      })
    )
    .errors(CommonPluginErrors)
});
