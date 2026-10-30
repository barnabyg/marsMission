# Mars Mission

A planning and simulation game in which you run a Mars exploration Program on a budget. Vocabulary is in [GLOSSARY.md](GLOSSARY.md), the rules are in [docs/game-design.md](docs/game-design.md) and the decisions behind them are in [docs/adr/](docs/adr/).

## Play

You need [Node.js](https://nodejs.org/) 24 or later. From the repository root, run:

```powershell
npm.cmd start
```

This installs what's needed, builds the game and opens it in your browser. The game is designed for a 3840×2160 desktop.

## Develop

The Simulation (`src/simulation`) holds all the rules and knows nothing about the browser. The Catalogue (`src/catalogue`) loads and validates the data files in `public/data`. Everything else displays what the Simulation produces.

| Command                | What it does                                  |
| ---------------------- | --------------------------------------------- |
| `npm.cmd run dev`      | Starts the development server                 |
| `npm.cmd test`         | Runs the Simulation and Catalogue tests       |
| `npm.cmd run test:e2e` | Runs the browser tests at 3840×2160           |
| `npm.cmd run verify`   | Runs every check (the canonical verification) |

The browser tests need Chromium, once per machine: `npx.cmd playwright install chromium`.

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
