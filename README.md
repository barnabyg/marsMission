# Mars Mission

A planning and simulation game in which you run a Mars exploration Program on a budget. Vocabulary is in [GLOSSARY.md](GLOSSARY.md), the rules are in [docs/game-design.md](docs/game-design.md) and the decisions behind them are in [docs/adr/](docs/adr/).

## Play

You need [Node.js](https://nodejs.org/) 24 or later. From the repository root, run:

```powershell
.\run.bat
```

You can also double-click `run.bat`. It installs what's needed, builds the game and opens it in your browser. The game is designed for a 4K desktop, at 100% or 150% display scaling.

To try the latest phase, follow the [Phase 4 playtest guide](docs/playtest/phase-4.md). The [Phase 1](docs/playtest/phase-1.md), [Phase 2](docs/playtest/phase-2.md) and [Phase 3](docs/playtest/phase-3.md) guides are kept as records of those phases, so some controls and numbers have changed since they were written: saving, loading and retiring are now buttons with dialogs, Mission Mode lists what happens in an events column, Assets are chosen with tick boxes, and Service Life, Science and money are as tuned for Phase 4.

## Develop

The Simulation holds all the rules and knows nothing about the browser. Everything else loads its data, saves its state or displays what it produces.

| Folder           | What it holds                                                                                                                                              |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app`        | The App component that moves between screens and connects them to the Simulation, all styles (`styles.css`), and start-up                                  |
| `src/balance`    | Balance runs: strategies that play whole Programs through the Simulation, the checks for invalid states and the report (see [Balance runs](#balance-runs)) |
| `src/catalogue`  | The Catalogue: parses and validates the data files in `public/data`, which `src/app` fetches                                                               |
| `src/mission`    | Mission Mode and the Turn summary: playback, sounds, and the views, each in its own subfolder, which `MissionMode.tsx` and `MissionScene.tsx` connect      |
| `src/planning`   | Planning Mode and the Program summary screen                                                                                                               |
| `src/save`       | The Save Store, which keeps what the Simulation saves in the browser, and the screens for saving: the opening screen and Save Slots                        |
| `src/simulation` | The Simulation: all the rules, with most of the tests, plus the small test catalogue and helpers those tests share                                         |
| `src/testing`    | Test support that reads the real data files with Node, which is kept out of `src/simulation` because that folder has no Node types                         |
| `src/ui`         | Shared UI: dialogs (`Dialog.tsx`), tooltips (`tooltips.ts`, `GameText.tsx`, `TooltipLayer.tsx`) and date formatting                                        |

Test fixtures go in `src/simulation/testCatalogue.ts` and `testHelpers.ts` for rule tests, which use round numbers so that balance changes don't break them. Use `src/testing/realCatalogue.ts` for tests of the game's actual balance.

A feature with new content touches these folders, in order:

1. `public/data`: the new content
2. `src/catalogue`: validating it, and `src/simulation/testCatalogue.ts` for a new Catalogue field
3. `src/simulation`: the rules, and a new format in `saveFormat.ts` for a new saved field
4. `src/planning` or `src/mission`: displaying it, with styles and wiring in `src/app`, plus `src/ui/tooltips.ts` and `GLOSSARY.md` for a new game term
5. `e2e`: a browser test of the journey

A ticket that only changes a screen or dialog starts from its component in `src/planning`, `src/mission` or `src/save`, and usually also touches `src/ui`, `src/app/styles.css` and the `e2e` file for that subject.

| Command                | What it does                                                   |
| ---------------------- | -------------------------------------------------------------- |
| `npm.cmd run dev`      | Starts the development server                                  |
| `npm.cmd test`         | Runs every test that doesn't need a browser                    |
| `npm.cmd run test:e2e` | Runs the browser tests, mostly at 3840×2160                    |
| `npm.cmd run verify`   | Runs every check (the canonical verification)                  |
| `npm.cmd run balance`  | Plays thousands of Programs and prints a report on the balance |

The browser tests need Chromium, once per machine: `npx.cmd playwright install chromium`.

The sound effects in `public/sounds` are synthesised by `node scripts/generate-sounds.mjs`, and the files it makes are committed. Rerun it only to change a sound.

### Balance runs

To check the balance without playing, run this from the repository root:

```powershell
npm.cmd run balance
```

It plays every strategy in `src/balance/strategies.ts` against the real data files, with no browser, for up to 20 Turns each on seeds 1 to 1000, and prints the report. That takes a few seconds. For a quick pass, use `npm.cmd run balance -- --programs 200`. The same command always gives the same report, so two runs can be compared line by line, for example before and after changing `public/data`. The results inform tuning and don't fail anything: the only part that can fail a build is the invalid-state test in `src/balance/balanceRuns.test.ts`, which plays a few Programs on each strategy. The command also stops with an error if a plan fails validation or a Turn leaves an invalid state.

The report starts with a summary with one row per strategy, of means per Program. Each strategy then has its own section:

- **Turn table:** one row per Turn. Everything except `Active%` is a mean over the Programs that played that Turn, at its end, so later rows only show the survivors and can rise when weaker Programs are cancelled. `Active%` is the share of all Programs still going. `Thresh$M` and `Grants$M` are that Turn's income from Funding Thresholds and Research Grants, `Thresh%` and `Grant%` are their shares of it, and `Spent$M` is the cost of Missions.
- **Research Grants pass Funding Thresholds:** the Turn from which Research Grants pay more than Funding Thresholds in every Turn, and the Turn by which they have paid more in total, going by the Turn table's means. Either can be "never".
- **Cancelled:** how many Programs were cancelled, how many of those still had an Asset operating, and a histogram of the Turns on which that happened.
- **Funding Threshold table:** the share of Programs that reached each one, and on what Turn on average.
- **First Mission failed:** how often the first Mission failed, how often the Program could launch again on the next Turn, and whether two failures in a row cancelled it. Then how Programs ended up, in money, Science and cancellations, according to whether that first Mission worked or failed, which shows what a gamble pays.
- **Science per Program:** what Ongoing Research earned, by Activity.

Strategies are simple on purpose, so a difference between two of them is only a rough guide to what a thoughtful player would find. Most launch whenever they can afford to, and run out of money. The ones named `steady:` play more carefully, keeping money back for a retry and keeping a few Assets at work, and each differs from `steady: Soil analysis` in one choice, so compare them with it to judge that choice.

To add a strategy, add an object to the `strategies` list, with no other change. Its `plan(view, tools)` sees what a player sees: the `ProgramView`, the previews and `tools.problemsWith(plan)`. It returns a `TurnPlan`, which must pass validation, so it has to cope with shortages of money and with what's on offer changing. The `campaign` helper in the same file covers the common case.

### Verification

`npm.cmd run verify` is the canonical check, and it runs in CI. It changes no tracked files, stops at the first failure, including the first failing test, and treats warning output as a failure. Run a test command directly to see every failure. In order, it runs:

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
