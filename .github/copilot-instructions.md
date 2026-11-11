# Project Instructions

## Stack

- Runtime: Cloudflare Workers (edge V8).
- UI: React with Vite.
- Package manager: npm.
- Tests: Vitest.

## Runtime and Code Conventions

- Keep code compatible with Cloudflare Workers' edge V8 runtime. Prefer Web Platform APIs such as Web Crypto; do not rely on Node.js native globals unless they are explicitly polyfilled and supported in the Worker deployment.
- Prefer the Cloudflare CLI (`cf` or `wrangler`) for local testing and deployments.
- Follow strict TypeScript type-safety and formatting conventions in TypeScript code. Preserve the existing language and patterns when changing JavaScript files.
- Check `status.md` and follow its trunk-based development rules before making branch or contribution workflow decisions. If it is unavailable, ask rather than assume project-specific rules.
- Put project documentation in `docs/`. Keep this file in `.github/` so GitHub Copilot can automatically discover the repository instructions.

## Game Rules

- Before planning, implementing, reviewing, or changing game mechanics, read `docs/requirements/what-if-game-rules.md` and `docs/requirements/online-game-requirements.md`.
- Treat the documented standard rules and online mode as canonical. Variations are optional and must not silently become defaults.
- Keep game rules and product requirements under `docs/requirements/`. Whenever gameplay or rules change, update the relevant canonical document(s) in the same change and update relevant tests.
- Record each completed `/interview` session in its own dated Markdown file under `docs/interviews/` and add it to `docs/interviews/README.md`; consult the index and relevant entries to retain prior decisions and avoid repeating questions. Do not combine interviews into one growing log file.

## Testing and CI/CD

- Every new feature branch must include a corresponding unit or integration test in `test/`, written with Vitest.
- Use GitHub Actions workflows as the repository's CI/CD pipeline, and keep automated checks aligned with the project's local validation.
