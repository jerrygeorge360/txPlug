# Contributing

Thanks for your interest in contributing.

## Quick start

1. Fork the repo.
2. Create a feature branch.
3. Implement changes with clear commit messages.
4. Open a PR with a concise description and screenshots or logs when relevant.

## Development guidelines

- Keep plugin contracts consistent: `getTransactions`, `getChainInfo`.
- Use `variables` for non-sensitive config and `secrets` for API keys.
- Prefer strict typing and avoid breaking changes to output schemas.
- Document provider caveats in each plugin README.

## Plugin checklist

- [ ] Contract matches standard schema.
- [ ] Service handles API errors cleanly.
- [ ] Plugin dev server runs and exports `remoteEntry.js`.
- [ ] Added entry to plugins.json (or provided a sample).
- [ ] README includes provider setup and required keys.

## Code style

- Use consistent formatting with the existing codebase.
- Avoid unrelated refactors in the same PR.

## Reporting issues

Include:
- Chain/provider
- Request payload
- Expected vs actual result
- Error logs or API response excerpts
