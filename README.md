# Mars Mission

A planning and simulation game in which you run a Mars exploration Program on a budget. Vocabulary is in [GLOSSARY.md](GLOSSARY.md), the rules are in [docs/design/](docs/design/), with what is built so far in [docs/game-design.md](docs/game-design.md), and the decisions behind them are in [docs/adr/](docs/adr/).

## Play

You need [Node.js](https://nodejs.org/) 24 or later. From the repository root, run:

```powershell
.\run.bat
```

You can also double-click `run.bat`. It installs what's needed, builds the game and opens it in your browser. The game is designed for a desktop monitor: 4K at 100% or 150% display scaling, or 1920×1080.

To try the latest phase, follow the [Phase 8 playtest guide](docs/playtest/phase-8.md). The [Phase 1](docs/playtest/phase-1.md), [Phase 2](docs/playtest/phase-2.md), [Phase 3](docs/playtest/phase-3.md), [Phase 4](docs/playtest/phase-4.md), [Phase 5](docs/playtest/phase-5.md), [Phase 6](docs/playtest/phase-6.md) and [Phase 7](docs/playtest/phase-7.md) guides are kept as records of those phases, so some controls and numbers have changed since they were written. The [Status](docs/game-design.md#status) section of the design doc lists what each phase built and what changed after its playtest. Only the current guide's known seeds are tested, in `src/catalogue/playtestSeedsPhase8.test.ts`, and those tests move to the new guide with each phase. If tuning breaks one, find a new seed that gives the same story and update the current guide, because earlier guides are records and aren't updated.

## Develop

The Simulation holds all the rules and knows nothing about the browser. Everything else loads its data, saves its state or displays what it produces.

- `src/app`: The App component that moves between screens and connects them to the Simulation, start-up, the base styles, the type scale every font size comes from and the hover, press and focus styles of every control (`styles.css`), the bundled heading font (`fonts`, with its source and licence in `fonts/SOURCES.md`), and the order every style file loads in (`main.tsx`)
- `src/balance`: Balance runs: strategies that play whole Programs through the Simulation, the checks for invalid states and the report (see [Balance runs](docs/develop/balance-runs.md))
- `src/catalogue`: The Catalogue: parses and validates the data files in `public/data`, which `src/app` fetches. Also the tests of the tuned balance and of the current playtest guide's known seeds (see [The Catalogue's files](docs/develop/catalogue.md))
- `src/mission`: Mission Mode and the Turn summary:
  - `MissionMode.tsx` puts Mission Mode together, and `MissionScene.tsx` draws the view showing. `missionViews.ts` lists the views and decides which one shows when, kept by `useMissionView.ts`. Playback is `playback.ts` with `usePlayback.ts`, and `DecisionPointPanel.tsx` holds the Turn at a Decision Point, with Tutorial mode's suggestion in the panel beside the scene
  - `sounds.ts` matches each Timeline entry to its sound, which `useSounds.ts` plays at the moment it happens
  - `EventsColumn.tsx`: the events column, which shows each entry as a card with a picture of what kind of thing happened, drawn as SVG in `eventArt` (`EventPictureArt.tsx`) and chosen by `eventArt/eventCard.ts`
  - A subfolder for each view: `solarSystem`, `marsOrbit`, `spacecraft` and `surface`. The journey home, `homeward.ts`, plays its parts in them one after another: Mars ascent at the Landing Site (`surface/ascent.ts`, drawn by `surface/AscentView.tsx`), the rendezvous in Mars orbit and Earth entry with its splashdown (`spacecraft/marsRendezvous.ts` and `spacecraft/splashdown.ts`, each drawn by the view file beside it), and the way home (`solarSystem/homewardJourney.ts`). The models of a base are in `surface/baseModels.tsx` and `surface/labModel.tsx`, with what they share in `surface/baseParts.tsx`, of the ascent vehicle in `surface/ascentModels.tsx`, and of the journey home in space in `spacecraft/homewardModels.tsx`. The surface models are built from the shapes in `surface/modelParts.tsx` and the shared details in `surface/modelDetails.tsx`, and lit by the materials in `surface/surfaceShading.ts`, which work out their own light from the surface's Sun rather than taking the scene's lights. The ground is drawn by `surface/SurfaceGround.tsx`: the terrain from `surface/terrain.ts`, its fine grain from `surface/detailTexture.ts` and the rocks lying on it from `surface/rocks.ts`, all worked out from the Landing Site's name
  - `TurnSummaryScreen.tsx`: the Turn summary, built from the `Summary*.tsx` parts, such as `SummarySamples.tsx` for samples cached, home and lost, with its Money split by `turnMoney.ts`
- `src/planning`: Planning Mode and the Program summary screen:
  - `PlanningMode.tsx` puts Planning Mode together. The status bar, `StatusBar.tsx`, shows what changed over the last Turn, what this Turn will spend beside the Money, and the Public Support gauge, worked out in `statusValues.ts`
  - `OperatingPanel.tsx`: Operating at Mars as a table, with a row for each Crew member and Asset already there (`OperatingRows.tsx`), the Assets grouped by place (`operatingGroups.ts`) and several of one kind numbered as they arrived (`src/simulation/assetLabels.ts`, which Mission Mode's labels use too), with the choice of their Activity (`ActivitySelect.tsx`, also used for a new Asset or Crew), of bringing round-trip Crew home (`WayHomeChoice.tsx`) and of sending each Landing Site's samples home (`SamplesHomeChoice.tsx`)
  - `MissionPanel.tsx`: the New Mission panel, whose plan `PlanningMode.tsx` keeps with `useMissionPlan.ts` so that the status bar can show the spend, with a cue over the foot of its steps while more are below (`ScrollCue.tsx`). Each part is a numbered step card, `MissionStepCard.tsx`, and `missionSteps.ts` says which steps apply yet, and folds the first to one line with a Change button once something is ticked: the Launch Vehicle and Trajectory, the Assets and Crew, with a return vehicle for Crew at Mars with no way home (`ReturnVehicleChoice.tsx`), the Landing Site and the Mission Events
  - `TutorialPanel.tsx`: Tutorial mode in Planning Mode: the offer to turn it on on a Program's first Turn, and its advice while it is on, with `src/ui/TurnOffTutorial.tsx` to turn it off, which Mission Mode uses too. The advice comes from `src/tutorial` through `useTutorialAdvice.ts`, and `TutorialAdvice.tsx` shows it; `TutorialEnding.tsx` shows how the tutorial ended, which `src/app/screens.ts` works out as each Planning session starts
  - `MissionAssetChoice.tsx`: an Asset's card, marked before it is ticked if it wouldn't fit, which `missionFit.ts` asks the Simulation, with an info button that opens the Asset's details, `AssetDetails.tsx`, and its Benefit tag from `benefitImpactText.ts`. The choices for each ticked Asset are in a list under the cards, `ChosenAssets.tsx`. The budget bar at the panel's foot, `BudgetBar.tsx`, shows cost and mass against their limits, with thresholds in `budgetGauge.ts`
- `src/save`: The Save Store, which keeps what the Simulation saves in the browser, and the screens for saving: the title screen (`OpeningScreen.tsx`, over `public/art/mars.jpg`) and Save Slots
- `src/simulation`: The Simulation: all the rules, with most of the tests, plus the small test catalogue and helpers those tests share (see [The Simulation's files](docs/develop/simulation.md))
- `src/testing`: Test support that reads the real data files with Node, kept out of `src/simulation`, which has no Node types: `realCatalogue.ts`, `realBalance.ts` and `playedStrategies.ts`
- `src/tutorial`: The tutorial's brain, with no UI, which the Planning and Mission Mode screens call through `tutorial.ts`: the route to Crew at a Base as a play style (`route.ts`), its stages (`stages.ts`), the advice for a Planning session, each choice of the plan it would make with why (`turnAdvice.ts` and `missionAdvice.ts`, with the reasons for Service Life and Activities, which quote the figures their choices show, in `choiceReasons.ts`) and why it changed course since the last Turn (`changeOfCourse.ts`), the suggested answer at a Decision Point (`decisions.ts`), and whether it has reached its goal or can't recover (`status.ts`, with the Base itself in `base.ts`). `tutorial.ts` also plays it as a strategy for the balance runs
- `src/ui`: Shared UI: dialogs (`Dialog.tsx`), tooltips (`tooltips.ts`, `GameText.tsx`, `TooltipLayer.tsx`, placed clear of nearby controls by `tooltipPlacement.ts`, with each term underlined once a panel, and a heading's ⓘ marker shown only where its body doesn't explain its terms, by `repeatedTerms.ts`), date and change formatting (`format.ts`), icons (`Icon.tsx`, drawn from `icons.ts`, with their source and licence in `SOURCES.md`), the styles the summary screens share (`summaryScreen.css`), and the tutorial's own style, which every block the tutorial shows in Planning and Mission Mode carries as the class `tutorial-voice` (`tutorial.css`)

Test fixtures go in `src/simulation/testCatalogue.ts` and `testHelpers.ts` for rule tests, which use round numbers so that balance changes don't break them. For tests of the game's actual balance, use `src/testing`. `realCatalogue.ts` has the real data files and a calm version with no Hazards. `realBalance.ts` has Simulations on the calm files in which every Mission Event fails or succeeds, and a plan for a Mission on the first Launch Vehicle with the first Asset. `playedStrategies.ts` has `played`, a strategy's means over 300 seeds played as in the balance runs. They're on the calm files, so they don't match the balance report. Each strategy is played once in each test file, however many tests ask for it. The tests of the balance runs and their report share fixtures of their own, in `src/balance/testHelpers.ts`, named as in `src/simulation` because each holds the fixtures for the tests of its own folder.

A feature with new content touches these folders, in order:

1. `public/data`: the new content
2. `src/catalogue`: validating it, and `src/simulation/testCatalogue.ts` for a new Catalogue field
3. `src/simulation`: the rules, and a new format in `saveFormat.ts` for a new saved field
4. `src/balance`, for a new rule or choice: the strategies that must cope with it, listed in `strategies.ts`, because every plan they make has to pass validation, and a check in `invalidStates.ts` for anything it makes impossible
5. `src/planning` or `src/mission`: displaying it, with styles and wiring in `src/app`, plus `src/ui/tooltips.ts` and `GLOSSARY.md` for a new game term
6. `e2e`: a browser test of the journey. A test that needs a known outcome, such as a landing that crashes or a dust storm on the second Turn, takes its seed from `e2e/seeds.ts`, `e2e/colossusSeeds.ts` for one that needs the Meridian Colossus, such as a Crewed Mission, `e2e/tutorialSeeds.ts` for saves where the tutorial ends, or `e2e/sampleSeeds.ts` for caching samples and sending them home, with `samplesReadySave`, a save with samples ready to go. They search the real data files for one rather than pinning a number, so add a search there for a new outcome

A ticket that only changes a screen or dialog starts from its component in `src/planning`, `src/mission` or `src/save`, and usually also touches `src/ui`, the style file beside its component, such as `src/planning/planning.css`, and the `e2e` file for that subject.

A balance change starts in `public/data` and is judged by comparing `npm.cmd run balance` reports from before and after. [Balance runs](docs/develop/balance-runs.md#what-a-balance-change-reaches) lists the tests, guides and strategies it usually reaches too.

| Command                | What it does                                                   |
| ---------------------- | -------------------------------------------------------------- |
| `npm.cmd run dev`      | Starts the development server                                  |
| `npm.cmd test`         | Runs every test that doesn't need a browser                    |
| `npm.cmd run test:e2e` | Runs the browser tests, at 3840×2160 or 1920×1080              |
| `npm.cmd run verify`   | Runs every check (the canonical verification)                  |
| `npm.cmd run balance`  | Plays thousands of Programs and prints a report on the balance |

No source, test, script or style file is over 500 lines, so that each can be read whole. ESLint's `max-lines` rule enforces this for TypeScript and scripts, and CSS files keep to it by hand. It doesn't cover `package-lock.json`, the data files in `public/data`, the generated art and sounds in `public`, or Markdown. When a file nears the limit, split it at a natural seam, such as by subject for tests or by screen for styles. A new style file is imported from `src/app/main.tsx`, in cascade order.

The browser tests need Chromium, once per machine: `npx.cmd playwright install chromium`. They run at 3840×2160, except the tests of how Mission Mode plays, which use `missionViewport` from `e2e/helpers.ts`, 1920×1080, because software rendering at 4K about doubles their time. A test of the layout, or of something only 4K shows, stays at 3840×2160.

The sound effects in `public/sounds` are synthesised by `node scripts/generate-sounds.mjs`, and the files it makes are committed. Rerun it only to change a sound.

The Asset cards' pictures in `public/art/assets`, one for each kind of Asset and one for the Crewed Mission, are drawn from Mission Mode's own models by `node scripts/generate-asset-art.mjs`, and the files it makes are committed. It starts the development server and opens `src/mission/assetArt/assetArt.html`, a page that isn't built into the game, in Chromium for each kind, with the camera, lights and size fixed, so rerunning it gives the same files. It needs Chromium installed for the browser tests. Rerun it after changing a model; a new kind of Asset needs its model chosen in `src/mission/assetArt/AssetArt.tsx` first, and `src/planning/assetImages.test.ts` fails until its picture is made.

The surface view is drawn by software at 4K on some machines, so a change to the terrain or the surface models is timed before and after with `node scripts/measure-surface-frames.mjs`. It opens `src/mission/surfaceBench/surfaceBench.html`, another page that isn't built, with one of every surface model standing at a Landing Site, in Chromium's software renderer at 3840×2160, and prints the median and mean frame time of each run. The machine's other work slows it, so compare runs made one after another. `--shots <directory>` also saves a 4K picture of the view and one close up on each model.

### Verification

`npm.cmd run verify` is the canonical check, and it runs in CI. It changes no tracked files, stops at the first failure, including the first failing test, and treats warning output as a failure. Run a test command directly to see every failure. In order, it runs:

1. Formatting: Prettier
2. Lint: ESLint with typescript-eslint's strict type-checked rules
3. Types: `tsc` over everything, and again over the Simulation and Catalogue with no browser or Node types
4. Static analysis: typescript-eslint's type-aware bug rules (in step 2), and Knip for unused code and dependencies
5. Tests: Vitest, then Playwright
6. Dependencies and secrets: `npm ls`, `npm audit` and Secretlint
7. Build: `vite build`. Package validation doesn't apply, because the game is private and isn't published as a package

CI runs on pull requests and on pushes to `main`, and splits the same gates across jobs that run at the same time: one runs `npm run verify -- --without-browser-tests`, and three each run a third of the browser tests with `npm run verify -- --browser-tests-only --shard=N/3`. Together they cover every gate. Run the same options locally to repeat one job.

### Documented exceptions

- `e2e/helpers.ts` and `scripts/verify.mjs` allow one browser warning, `THREE.Clock` deprecated, because it comes from inside `@react-three/fiber`. Remove it once an upgrade stops the warning.
- `vite.config.ts` raises the chunk size warning limit to 1200 kB for the Three.js chunk, because the game runs locally (ADR 0001). Review it if the game is ever hosted.
- `knip.json` ignores `@secretlint/secretlint-rule-preset-recommend`, because only `.secretlintrc.json` uses it, by name. Review it if Secretlint's configuration moves into code.
- `package.json` overrides `minimatch` to 11.0.3, above the `^10` that ESLint and typescript-eslint ask for, because `npm audit` reports GHSA-g3hv-75wg-m249 in every version below 11.0.1. It's only used by development tools, and linting still passes. Remove it once those packages depend on a fixed version.
- `eslint.config.mjs` allows numbers in template strings, which the strict preset forbids, because Science, Public Support and day counts are shown that way and converting each one adds noise and catches nothing. Review it if numbers ever need locale formatting.
