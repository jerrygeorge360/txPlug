# Contributing

Thanks for jumping in.

## Quick start

1. Fork the repo.
2. Create a feature branch.
3. Make your changes with clear commits.
4. Open a PR with a short, specific description (screenshots/logs help).

## Development guidelines

- Keep plugin contracts consistent: `getTransactions`, `getChainInfo`.
- Put non‑sensitive config in `variables`, API keys in `secrets`.
- Prefer strict typing and avoid breaking changes to output schemas.
- Document provider caveats in each plugin README.

## Using the template

If you’re adding a new chain, start from the template at templates/plugin-template. It already includes the standard contract, dev server config, and project structure. Replace the service logic, update the names, and build/deploy to get a remoteEntry.js URL.

## Registering your plugin in plugins.json

After your plugin is deployed, add an entry to plugins.json so the watcher can load it. Use this shape:

- enabled: true
- remote: URL to remoteEntry.js
- secrets: provider keys (keep empty in committed files)
- variables: chain/provider config

You can copy templates/plugins.json.template as a starting point.

## Plugin checklist

- [ ] Contract matches standard schema.
- [ ] Service handles API errors cleanly.
- [ ] Plugin dev server runs and exports `remoteEntry.js`.
- [ ] Added entry to plugins.json (or provided a sample).
- [ ] README includes provider setup and required keys.

## Code style

- Keep formatting consistent with the existing codebase.
- Avoid unrelated refactors in the same PR.

## Reporting issues

Include:
- Chain/provider
- Request payload
- Expected vs actual result
- Error logs or API response excerpts
