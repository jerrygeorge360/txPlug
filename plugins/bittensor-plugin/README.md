# bittensor-plugin

Bittensor transactions plugin using Subtensor RPC.

## Dev

```bash
bun install
bun run dev
```

Note: Substrate RPC does not return account transaction history without decoding blocks/extrinsics. This plugin currently returns an empty transaction list until a Subtensor indexer is wired in.
