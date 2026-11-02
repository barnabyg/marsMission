# Mars Mission

A planning and simulation game in which you run a Mars exploration Program on a budget. Vocabulary is in [GLOSSARY.md](GLOSSARY.md), the rules are in [docs/game-design.md](docs/game-design.md) and the decisions behind them are in [docs/adr/](docs/adr/).

## Play

You need [Node.js](https://nodejs.org/) 24 or later. From the repository root, run:

```powershell
.\run.bat
```

You can also double-click `run.bat`. It installs what's needed, builds the game and opens it in your browser. The game is designed for a 4K desktop, at 100% or 150% display scaling.

To try the latest phase, follow the [Phase 5 playtest guide](docs/playtest/phase-5.md). The [Phase 1](docs/playtest/phase-1.md), [Phase 2](docs/playtest/phase-2.md), [Phase 3](docs/playtest/phase-3.md) and [Phase 4](docs/playtest/phase-4.md) guides are kept as records of those phases, so some controls and numbers have changed since they were written: saving, loading and retiring are now buttons with dialogs, Mission Mode lists what happens in an events column, Assets are chosen with tick boxes, Service Life, Science and money are as tuned for Phase 4, and Phase 5 adds Decision Points that can stop play, with new costs for the Trajectories. Only the current guide's known seeds are tested, in `src/catalogue/playtestSeedsPhase5.test.ts`, and those tests move to the new guide with each phase. If tuning breaks one, find a new seed that gives the same story and update the current guide, because earlier guides are records and aren't updated.

## Develop

The Simulation holds all the rules and knows nothing about the browser. Everything else loads its data, saves its state or displays what it produces.

| Folder           | What it holds                                                                                                                                                                     |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app`        | The App component that moves between screens and connects them to the Simulation, start-up, the base styles (`styles.css`), and the order every style file loads in (`main.tsx`)  |
| `src/balance`    | Balance runs: strategies that play whole Programs through the Simulation, the checks for invalid states and the report (see [Balance runs](#balance-runs))                        |
| `src/catalogue`  | The Catalogue: parses and validates the data files in `public/data`, which `src/app` fetches. Also the tests of the tuned balance and of the current playtest guide's known seeds |
| `src/mission`    | Mission Mode and the Turn summary: playback, sounds, and the views, each in its own subfolder, which `MissionMode.tsx` and `MissionScene.tsx` connect                             |
| `src/planning`   | Planning Mode and the Program summary screen                                                                                                                                      |
| `src/save`       | The Save Store, which keeps what the Simulation saves in the browser, and the screens for saving: the opening screen and Save Slots                                               |
| `src/simulation` | The Simulation: all the rules, with most of the tests, plus the small test catalogue and helpers those tests share (see [The Simulation's files](#the-simulations-files))         |
| `src/testing`    | Test support that reads the real data files with Node, which is kept out of `src/simulation` because that folder has no Node types                                                |
| `src/ui`         | Shared UI: dialogs (`Dialog.tsx`), tooltips (`tooltips.ts`, `GameText.tsx`, `TooltipLayer.tsx`), date formatting, and the styles the summary screens share (`summaryScreen.css`)  |

Test fixtures go in `src/simulation/testCatalogue.ts` and `testHelpers.ts` for rule tests, which use round numbers so that balance changes don't break them. Use `src/testing/realCatalogue.ts` for tests of the game's actual balance.

A feature with new content touches these folders, in order:

1. `public/data`: the new content
2. `src/catalogue`: validating it, and `src/simulation/testCatalogue.ts` for a new Catalogue field
3. `src/simulation`: the rules, and a new format in `saveFormat.ts` for a new saved field
4. `src/balance`, for a new rule or choice: the strategies in `strategies.ts` that must cope with it, because every plan they make has to pass validation, and a check in `invalidStates.ts` for anything it makes impossible
5. `src/planning` or `src/mission`: displaying it, with styles and wiring in `src/app`, plus `src/ui/tooltips.ts` and `GLOSSARY.md` for a new game term
6. `e2e`: a browser test of the journey. A test that needs a known outcome, such as a landing that crashes or a dust storm on the second Turn, takes its seed from `e2e/seeds.ts`, which searches the real data files for one rather than pinning a number, so add a search there for a new outcome

A ticket that only changes a screen or dialog starts from its component in `src/planning`, `src/mission` or `src/save`, and usually also touches `src/ui`, the style file beside its component, such as `src/planning/planning.css`, and the `e2e` file for that subject.

A balance change starts in `public/data` and is judged by comparing `npm.cmd run balance` reports from before and after (see [Balance runs](#balance-runs)). It usually also reaches the tests of the tuned balance and the current playtest guide's known seeds in `src/catalogue`, the current guide in `docs/playtest`, and `src/balance/strategies.ts` if a strategy stops coping. It also reaches `e2e`: browser tests play with the real data files, so money, Public Support and Science figures in them can change with tuning, and a seed found in `e2e/seeds.ts` can change too. Rule tests in `src/simulation` use the test catalogue, so tuning doesn't touch them.

| Command                | What it does                                                   |
| ---------------------- | -------------------------------------------------------------- |
| `npm.cmd run dev`      | Starts the development server                                  |
| `npm.cmd test`         | Runs every test that doesn't need a browser                    |
| `npm.cmd run test:e2e` | Runs the browser tests, mostly at 3840×2160                    |
| `npm.cmd run verify`   | Runs every check (the canonical verification)                  |
| `npm.cmd run balance`  | Plays thousands of Programs and prints a report on the balance |

No source, test, script or style file is over 500 lines, so that each can be read whole. ESLint's `max-lines` rule enforces this for TypeScript and scripts, and CSS files keep to it by hand. It doesn't cover `package-lock.json`, the data files in `public/data`, the generated art and sounds in `public`, or Markdown. When a file nears the limit, split it at a natural seam, such as by subject for tests or by screen for styles. A new style file is imported from `src/app/main.tsx`, in cascade order.

The browser tests need Chromium, once per machine: `npx.cmd playwright install chromium`.

The sound effects in `public/sounds` are synthesised by `node scripts/generate-sounds.mjs`, and the files it makes are committed. Rerun it only to change a sound.

### The Catalogue's files

`parseCatalogue` in `catalogue.ts` checks each data file against its schema in `schemas.ts`, then runs the cross-checks, which check the files against each other, one subject per file. A new field goes in `schemas.ts`. A check that needs another file goes in the cross-check for its subject, or, for a new subject such as Technology, in a new file beside them, added to the `crossChecks` list in `catalogue.ts`.

| File                         | What it cross-checks                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `crossCheckIds.ts`           | That each id is used once in its file                                                                         |
| `crossCheckMissionEvents.ts` | The Mission Events that Launch Vehicles, Assets and Contingencies refer to, and one Contingency per event     |
| `crossCheckHazards.ts`       | Dust storms and solar particle events against the Turn and the Trajectories                                   |
| `crossCheckAssets.ts`        | Assets: Mission Events that need a Landing Site, Landing Sites, Activities and Service Life                   |
| `crossCheckMilestones.ts`    | Milestones that can be earned, and Funding Thresholds in ascending order                                      |
| `crossCheckReliability.ts`   | Reliability levels in order, and Risk Bands that cover every failure probability                              |
| `crossCheckTrajectories.ts`  | Trajectories and Free-returns that finish within a Turn                                                       |
| `crossCheckTechnology.ts`    | Technology Readiness: unproven costs and risks, Development, and ids unique across Assets and Launch Vehicles |

### The Simulation's files

Everything outside `src/simulation` reaches the rules through `createSimulation` in `simulation.ts`. A Turn runs in this order:

1. `simulation.ts`, in `workOutTurn`, checks the plan with `planCheck.ts` and flies the Mission with `flyMission.ts`.
2. `turnSteps.ts` carries out the rest of the Turn's steps, in `resolveTurn`: Milestones for arriving and for a first landing, technologies that became Flight-proven (`flightProven.ts`), Development started and finished (`development.ts`), Assets at work (`assetsInService.ts`), dust storms (`dustStorms.ts`), Surveys, Ongoing Research (`ongoingResearch.ts`), Science Milestones (`scienceMilestones.ts`), Funding Thresholds and the fading of Public Support. It builds the next Program, the Timeline and the Turn summary.
3. `simulation.ts` stops at the earliest Decision Point that has no answer, from the Mission or a dust storm, and gives the Timeline up to it.

| File                                                          | What it holds                                                                                                                                 |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `simulation.ts`                                               | The Simulation's interface: starting, saving and restoring a Program, what the player sees of it, previews, and working out or running a Turn |
| `types.ts`                                                    | The shapes the Simulation takes and gives: plans, the Program and what the player sees of it, and the Turn summary                            |
| `timeline.ts`                                                 | The Timeline: what happened in a Turn, as Mission Mode plays it                                                                               |
| `rules.ts`                                                    | `createRules`: looking things up in the Catalogue, such as the Trajectory or Mission Events a Mission has, and failure chances; plus `roll`   |
| `planCheck.ts`                                                | What a plan costs and weighs, and what's wrong with it, if anything                                                                           |
| `flyMission.ts`                                               | The Turn's Mission: its Mission Events, Contingencies, go/no-go checks and solar particle events                                              |
| `missionReport.ts`                                            | How the Turn's Mission shows on the Timeline, also up to a Decision Point, and in the Turn summary                                            |
| `technologyReadiness.ts`                                      | Technology Readiness in a Program: whether a technology is Flight-proven, what it costs and how much it raises failure probabilities          |
| `flightProven.ts`                                             | The technologies a Mission used successfully for the first time, which become Flight-proven                                                   |
| `development.ts`                                              | Development: the technologies that need it, starting it in a plan, and what finishes when                                                     |
| `turnSteps.ts`                                                | The steps of a Turn after the Mission, in order (above), and the next Program, Timeline and Turn summary                                      |
| `assetsInService.ts`                                          | Which Assets operate for which days of the Turn, their failures and end of Service Life, and Surveys                                          |
| `ongoingResearch.ts`                                          | What each Activity earns in Science, Public Support and Research Grants                                                                       |
| `scienceMilestones.ts`                                        | The day a total of Science or Public Support is reached, for Science Milestones and Funding Thresholds                                        |
| `dustStorms.ts`                                               | Dust storms over Landing Sites, and sheltering or carrying on                                                                                 |
| `solarParticleEvents.ts`                                      | Solar particle events on the way to Mars, and safe mode or carrying on                                                                        |
| `saveFormat.ts`                                               | Each released save format and how to upgrade it to the next                                                                                   |
| `testCatalogue.ts`, `testHelpers.ts`, `scienceTestHelpers.ts` | Fixtures and helpers for the rule tests                                                                                                       |

A new rule usually goes in the file for its step of the Turn, or a new file beside them for a new Hazard, called from `turnSteps.ts` if it happens at Mars and from `flyMission.ts` if it happens to the Mission. Its tests go in a test file named after the rule. A new Hazard usually also needs a Decision Point kind and its answers in `types.ts`, an entry for it in `timeline.ts`, a cautious answer in `simulation.ts`, and switching off in `calmCatalogueFiles` in `src/testing/realCatalogue.ts`, so that tests of the rest of the balance aren't disturbed by it.

### Balance runs

To check the balance without playing, run this from the repository root:

```powershell
npm.cmd run balance
```

It plays every strategy in `src/balance/strategies.ts` against the real data files, with no browser, for up to 20 Turns each on seeds 1 to 1000, and prints the report. That takes about half a minute. For a quick pass, use `npm.cmd run balance -- --programs 200`. The same command always gives the same report, so two runs can be compared line by line, for example before and after changing `public/data`. The results inform tuning and don't fail anything: the only part that can fail a build is the invalid-state test in `src/balance/balanceRuns.test.ts`, which plays a few Programs on each strategy. The command also stops with an error if a plan fails validation or a Turn leaves an invalid state.

The report starts with a summary with one row per strategy, of means per Program. Next, **Decision Points by answer** has a row for each answer each strategy gave to each kind of Decision Point, with the share of its Programs that gave it at least once and how those Programs ended. Compare two strategies that differ only in that answer, such as `steady: Soil analysis`, which shelters from dust storms, and `steady: carry on through storms`. Each strategy then has its own section:

- **Turn table:** one row per Turn. Everything except `Active%` is a mean over the Programs that played that Turn, at its end, so later rows only show the survivors and can rise when weaker Programs are cancelled. `Active%` is the share of all Programs still going. `Thresh$M` and `Grants$M` are that Turn's income from Funding Thresholds and Research Grants, `Thresh%` and `Grant%` are their shares of it, and `Spent$M` is the cost of Missions and Development.
- **Research Grants pass Funding Thresholds:** the Turn from which Research Grants pay more than Funding Thresholds in every Turn, and the Turn by which they have paid more in total, going by the Turn table's means. Either can be "never".
- **Cancelled:** how many Programs were cancelled, how many of those still had an Asset operating, and a histogram of the Turns on which that happened.
- **Funding Threshold table:** the share of Programs that reached each one, and on what Turn on average.
- **First Mission failed:** how often the first Mission failed, how often the Program could launch again on the next Turn, and whether two failures in a row cancelled it. Then how Programs ended up, in money, Science and cancellations, according to whether that first Mission worked or failed, which shows what a gamble pays.
- **Decision Points:** how many per Program of each kind, the share of Turns with at least one, and how many Contingencies ended with the Assets saved.
- **Science per Program:** what Ongoing Research earned, by Activity.

Strategies are simple on purpose, so a difference between two of them is only a rough guide to what a thoughtful player would find. Most launch whenever they can afford to, and run out of money. The ones named `steady:` play more carefully, keeping money back for a retry and keeping a few Assets at work, and each differs from `steady: Soil analysis` in one choice, so compare them with it to judge that choice.

To add a strategy, add an object to the `strategies` list, with no other change. Its `plan(view, tools)` sees what a player sees: the `ProgramView`, the previews and `tools.problemsWith(plan)`. It returns a `TurnPlan`, which must pass validation, so it has to cope with shortages of money and with what's on offer changing. It can also have an `answer(decisionPoint, view)` for what it does at a Decision Point, and takes the first choice offered if it hasn't. The `playStyle` helper in `src/balance/playStyle.ts` covers the common case.

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
