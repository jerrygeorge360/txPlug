# Data Aggregator (Every-Plugin Runtime)

A plugin-driven wallet transaction aggregator. The server dynamically loads chain plugins from plugins.json and exposes a unified HTTP API without requiring restarts when plugins are added, removed, or updated.

## What this is

- A runtime host for chain-specific plugins (EVM, Solana, Polkadot/Moonbeam, Bitcoin, UTXO, Cardano, NEAR, Aptos, Sui, Tezos, Tron, Bittensor).
- A unified API for transactions, chain metadata, and CSV export.
- A hot-reloadable plugin registry driven by plugins.json.

## How it works

- Each plugin implements a standard oRPC contract (getTransactions, getChainInfo).
- The server watches plugins.json and reloads the runtime on changes.
- Plugins are loaded via remoteEntry URLs (Module Federation) so plugin builds can be deployed independently.

## Project layout

- plugins/: Chain-specific plugins following the every-plugin structure.
- server/: Fastify runtime host that mounts plugin clients and exposes HTTP routes.
- plugins.json: Registry of plugins with remote URLs, secrets, and variables.

## API overview

- GET /health
- GET /api/chains
- GET /api/:chain/transactions/:address?limit=100&offset=0
- GET /api/:chain/info
- GET /api/:chain/export/:address (Awakens CSV format)

## Configuration

plugins.json controls which plugins are enabled and how they are configured.

Common fields:
- enabled: boolean
- remote: URL to the plugin remoteEntry.js
- secrets: provider-specific API keys
- variables: chain/provider settings

Local dev uses the port defined in each plugin’s plugin.dev.ts.

Security controls:
- allowlist: list of approved remote hosts (host:port) in plugins.json
- requireChecksum: when true, plugins must provide a sha256 checksum
- checksum: sha256 of remoteEntry.js content

## Development

1. Start any plugin dev servers you want to use.
2. Start the server.
3. Edit plugins.json to enable/disable plugins or update configuration.

The server will reload automatically when plugins.json changes.

## Production workflow (template-first)

Use the template so contributors don’t need to commit to this repo:

1. Clone the template in templates/plugin-template
2. Implement the provider logic and build it
3. Deploy the build anywhere (e.g., Zephyr) to get a remoteEntry.js URL
4. Update plugins.json with that remote URL, secrets, and variables

This keeps the core server stable and allows third parties to own their plugin lifecycle.

## Extending the project

To add a new chain:
1. Create a new plugin under plugins/ following the standard structure:
   - src/contract.ts
   - src/service.ts
   - src/index.ts
   - rspack.config.cjs
   - plugin.dev.ts
2. Expose getTransactions and getChainInfo in the contract.
3. Implement a service that calls the target chain API.
4. Build and serve the plugin to produce a remoteEntry.js.
5. Add the plugin entry to plugins.json.

You can also replace the remote URL with a CDN deployment for production.

## Upgrading a plugin

1. Build and deploy the updated plugin to a new immutable URL (recommended).
2. Update plugins.json with the new `remote` URL.
3. If checksums are enabled, update the `checksum` to match the new build.
4. The server watcher reloads automatically.

## Contribution guidelines

- Keep plugin contracts consistent (getTransactions, getChainInfo).
- Prefer strict typing and minimal side effects in services.
- Add provider configuration via variables + secrets in plugins.json.
- Avoid breaking changes to API paths and output schemas.
- Document any chain-specific caveats in the plugin README.

## Notes and caveats

- Some APIs require keys (Blockfrost, Subscan, Covalent, Helius, TronGrid).
- Bittensor RPC does not expose account history without indexing; the plugin is a placeholder until an indexer is wired in.
- Some plugins return simplified values where providers don’t expose exact fields (e.g., fees or to-address for UTXO chains).

## License

MIT (add or update as needed).
