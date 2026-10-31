# Mars Mission

A planning and simulation game in which you run a Mars exploration Program on a budget. Vocabulary is in [GLOSSARY.md](GLOSSARY.md), the rules are in [docs/game-design.md](docs/game-design.md) and the decisions behind them are in [docs/adr/](docs/adr/).

## Play

You need [Node.js](https://nodejs.org/) 24 or later. From the repository root, run:

```powershell
.\run.bat
```

You can also double-click `run.bat`. It installs what's needed, builds the game and opens it in your browser. The game is designed for a 4K desktop, at 100% or 150% display scaling.

The [Phase 1](docs/playtest/phase-1.md) and [Phase 2](docs/playtest/phase-2.md) playtest guides are kept as records of those phases, so some controls have changed since they were written: saving, loading and retiring are now buttons with dialogs, and Mission Mode lists what happens in an events column.

## Develop

The Simulation (`src/simulation`) holds all the rules and knows nothing about the browser. The Catalogue (`src/catalogue`) loads and validates the data files in `public/data`. The Save Store (`src/save`) keeps what the Simulation saves in the browser. Everything else displays what the Simulation produces.

A typical feature touches these folders, in order:

1. `public/data`: the new content
2. `src/catalogue`: validating it
3. `src/simulation`: the rules, with most of the tests
4. `src/planning` or `src/mission`: displaying it, with styles and wiring in `src/app`, plus `src/ui/tooltips.ts` and `GLOSSARY.md` for a new game term
5. `e2e`: a browser test of the journey

| Command                | What it does                                  |
| ---------------------- | --------------------------------------------- |
| `npm.cmd run dev`      | Starts the development server                 |
| `npm.cmd test`         | Runs every test that doesn't need a browser   |
| `npm.cmd run test:e2e` | Runs the browser tests, mostly at 3840×2160   |
| `npm.cmd run verify`   | Runs every check (the canonical verification) |

The browser tests need Chromium, once per machine: `npx.cmd playwright install chromium`.

The sound effects in `public/sounds` are synthesised by `node scripts/generate-sounds.mjs`, and the files it makes are committed. Rerun it only to change a sound.

### Verification

`npm.cmd run verify` is the canonical check, and it runs in CI. It changes no tracked files, stops at the first failure and treats warning output as a failure. In order, it runs:

1. Formatting: Prettier
2. Lint: ESLint with typescript-eslint's strict type-checked rules
3. Types: `tsc` over everything, and again over the Simulation and Catalogue with no browser or Node types
4. Static analysis: typescript-eslint's type-aware bug rules (in step 2), and Knip for unused code and dependencies
5. Tests: Vitest, then Playwright
6. Dependencies and secrets: `npm ls`, `npm audit` and Secretlint
7. Build: `vite build`

Package validation doesn't apply, because the game is private and isn't published as a package.

### Documented exceptions

- `e2e/helpers.ts` and `scripts/verify.mjs` allow one browser warning, `THREE.Clock` deprecated, because it comes from inside `@react-three/fiber`. Remove it once an upgrade stops the warning.
- `vite.config.ts` raises the chunk size warning limit to 1200 kB for the Three.js chunk, because the game runs locally (ADR 0001). Review it if the game is ever hosted.
- `knip.json` ignores `@secretlint/secretlint-rule-preset-recommend`, because only `.secretlintrc.json` uses it, by name. Review it if Secretlint's configuration moves into code.
- `package.json` overrides `minimatch` to 11.0.3, above the `^10` that ESLint and typescript-eslint ask for, because `npm audit` reports GHSA-g3hv-75wg-m249 in every version below 11.0.1. It's only used by development tools, and linting still passes. Remove it once those packages depend on a fixed version.
- `eslint.config.mjs` allows numbers in template strings, which the strict preset forbids, because Science, Public Support and day counts are shown that way and converting each one adds noise and catches nothing. Review it if numbers ever need locale formatting.
