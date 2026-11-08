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
- `src/balance`: Balance runs: strategies that play whole Programs through the Simulation, the checks for invalid states and the report (see [Balance runs](#balance-runs))
- `src/catalogue`: The Catalogue: parses and validates the data files in `public/data`, which `src/app` fetches. Also the tests of the tuned balance and of the current playtest guide's known seeds
- `src/mission`: Mission Mode and the Turn summary:
  - `MissionMode.tsx` puts Mission Mode together, and `MissionScene.tsx` draws the view showing. `missionViews.ts` lists the views and decides which one shows when, kept by `useMissionView.ts`. Playback is `playback.ts` with `usePlayback.ts`, and `DecisionPointPanel.tsx` holds the Turn at a Decision Point
  - `sounds.ts` matches each Timeline entry to its sound, which `useSounds.ts` plays at the moment it happens
  - `EventsColumn.tsx`: the events column, which shows each entry as a card with a picture of what kind of thing happened, drawn as SVG in `eventArt` (`EventPictureArt.tsx`) and chosen by `eventArt/eventCard.ts`
  - A subfolder for each view: `solarSystem`, `marsOrbit`, `spacecraft` and `surface`. The journey home, `homeward.ts`, plays its parts in them one after another: Mars ascent at the Landing Site (`surface/ascent.ts`, drawn by `surface/AscentView.tsx`), the rendezvous in Mars orbit and Earth entry with its splashdown (`spacecraft/marsRendezvous.ts` and `spacecraft/splashdown.ts`, each drawn by the view file beside it), and the way home (`solarSystem/homewardJourney.ts`). The models of a base are in `surface/baseModels.tsx`, of the ascent vehicle in `surface/ascentModels.tsx`, and of the journey home in space in `spacecraft/homewardModels.tsx`
  - `TurnSummaryScreen.tsx`: the Turn summary, built from the `Summary*.tsx` parts, such as `SummarySamples.tsx` for samples cached, home and lost, with its Money split by `turnMoney.ts`
- `src/planning`: Planning Mode and the Program summary screen:
  - `PlanningMode.tsx` puts Planning Mode together. The status bar, `StatusBar.tsx`, shows what changed over the last Turn, what this Turn will spend beside the Money, and the Public Support gauge, worked out in `statusValues.ts`
  - `OperatingPanel.tsx`: Operating at Mars, the Assets and Crew already there, with the choice of their Activity (`ActivitySelect.tsx`, also used for a new Asset or Crew), of bringing round-trip Crew home (`WayHomeChoice.tsx`) and of sending each Landing Site's samples home (`SamplesHomeChoice.tsx`)
  - `MissionPanel.tsx`: the New Mission panel, whose plan `PlanningMode.tsx` keeps with `useMissionPlan.ts` so that the status bar can show the spend. Each part is a numbered step card, `MissionStepCard.tsx`, and `missionSteps.ts` says which steps apply yet: the Launch Vehicle and Trajectory, the Assets and Crew, with a return vehicle for Crew at Mars with no way home (`ReturnVehicleChoice.tsx`), the Landing Site and the Mission Events
  - `TutorialPanel.tsx`: Tutorial mode in Planning Mode: the offer to turn it on in a new Program's first Planning session, and its advice while it is on, with `src/ui/TurnOffTutorial.tsx` to turn it off, which Mission Mode uses too. The advice comes from `src/tutorial` through `useTutorialAdvice.ts`, and `TutorialAdvice.tsx` shows it; `TutorialEnding.tsx` shows how the tutorial ended, which `src/app/screens.ts` works out as each Planning session starts
  - `MissionAssetChoice.tsx`: an Asset's card, marked before it is ticked if it wouldn't fit, which `missionFit.ts` asks the Simulation, with an info button that opens the Asset's details, `AssetDetails.tsx`. The budget bar at the panel's foot, `BudgetBar.tsx`, shows cost and mass against their limits, with thresholds in `budgetGauge.ts`
- `src/save`: The Save Store, which keeps what the Simulation saves in the browser, and the screens for saving: the title screen (`OpeningScreen.tsx`, over `public/art/mars.jpg`) and Save Slots
- `src/simulation`: The Simulation: all the rules, with most of the tests, plus the small test catalogue and helpers those tests share (see [The Simulation's files](#the-simulations-files))
- `src/testing`: Test support that reads the real data files with Node, kept out of `src/simulation`, which has no Node types: `realCatalogue.ts`, `realBalance.ts` and `playedStrategies.ts`
- `src/tutorial`: The tutorial's brain, with no UI, which the Planning and Mission Mode screens call through `tutorial.ts`: the route to Crew at a Base as a play style (`route.ts`), its stages (`stages.ts`), the advice for a Planning session, each choice of the plan it would make with why (`turnAdvice.ts` and `missionAdvice.ts`) and why it changed course since the last Turn (`changeOfCourse.ts`), the suggested answer at a Decision Point (`decisions.ts`), and whether it has reached its goal or can't recover (`status.ts`, with the Base itself in `base.ts`). `tutorial.ts` also plays it as a strategy for the balance runs
- `src/ui`: Shared UI: dialogs (`Dialog.tsx`), tooltips (`tooltips.ts`, `GameText.tsx`, `TooltipLayer.tsx`, placed clear of nearby controls by `tooltipPlacement.ts`, with each term underlined once a panel by `repeatedTerms.ts`), date and change formatting (`format.ts`), icons (`Icon.tsx`, drawn from `icons.ts`, with their source and licence in `SOURCES.md`), and the styles the summary screens share (`summaryScreen.css`)

Test fixtures go in `src/simulation/testCatalogue.ts` and `testHelpers.ts` for rule tests, which use round numbers so that balance changes don't break them. For tests of the game's actual balance, use `src/testing`. `realCatalogue.ts` has the real data files and a calm version with no Hazards. `realBalance.ts` has Simulations on the calm files in which every Mission Event fails or succeeds, and a plan for a Mission on the first Launch Vehicle with the first Asset. `playedStrategies.ts` has `played`, a strategy's means over 300 seeds played as in the balance runs. They're on the calm files, so they don't match the balance report. Each strategy is played once in each test file, however many tests ask for it. The tests of the balance runs and their report share fixtures of their own, in `src/balance/testHelpers.ts`, named as in `src/simulation` because each holds the fixtures for the tests of its own folder.

A feature with new content touches these folders, in order:

1. `public/data`: the new content
2. `src/catalogue`: validating it, and `src/simulation/testCatalogue.ts` for a new Catalogue field
3. `src/simulation`: the rules, and a new format in `saveFormat.ts` for a new saved field
4. `src/balance`, for a new rule or choice: the strategies that must cope with it, listed in `strategies.ts`, because every plan they make has to pass validation, and a check in `invalidStates.ts` for anything it makes impossible
5. `src/planning` or `src/mission`: displaying it, with styles and wiring in `src/app`, plus `src/ui/tooltips.ts` and `GLOSSARY.md` for a new game term
6. `e2e`: a browser test of the journey. A test that needs a known outcome, such as a landing that crashes or a dust storm on the second Turn, takes its seed from `e2e/seeds.ts`, `e2e/colossusSeeds.ts` for one that needs the Meridian Colossus, such as a Crewed Mission, `e2e/tutorialSeeds.ts` for saves where the tutorial ends, or `e2e/sampleSeeds.ts` for caching samples and sending them home, with `samplesReadySave`, a save with samples ready to go. They search the real data files for one rather than pinning a number, so add a search there for a new outcome

A ticket that only changes a screen or dialog starts from its component in `src/planning`, `src/mission` or `src/save`, and usually also touches `src/ui`, the style file beside its component, such as `src/planning/planning.css`, and the `e2e` file for that subject.

A balance change starts in `public/data` and is judged by comparing `npm.cmd run balance` reports from before and after (see [Balance runs](#balance-runs)). It usually also reaches the tests of the tuned balance in `src/catalogue`, one file for each phase or post-playtest change that tuned it: `balancePhase3.test.ts`, which also holds the tests of the first Missions from before Phase 3, `balancePhase4.test.ts`, `balancePhase6.test.ts`, `balancePhase7.test.ts`, `balanceBaseFunding.test.ts`, for base funding since the Phase 7 playtest, and `balancePhase8.test.ts`, with the fuel plant, habitat and Mars lab in `balancePhase8Base.test.ts` so that the two play at the same time. All but Phase 3 test a strategy's means over many Programs, which they get from `src/testing/playedStrategies.ts`, so changing a strategy can break them too. It also reaches the current playtest guide's known seeds in `src/catalogue/playtestSeedsPhase8.test.ts`, the current guide in `docs/playtest`, and `src/balance/strategies.ts` if a strategy stops coping. And it reaches `e2e`: browser tests play with the real data files, so money, Public Support and Science figures in them can change with tuning, and a seed found in `e2e/seeds.ts` can change too. Rule tests in `src/simulation` use the test catalogue, so tuning doesn't touch them.

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

### The Catalogue's files

`parseCatalogue` in `catalogue.ts` checks each data file against its schema in `schemas.ts`, then runs the cross-checks, which check the files against each other, one subject per file. `schemas.ts` lists every schema, and holds those for the Program, Trajectories, Landing Sites, Mission Events, Contingencies, Hazards, Milestones, Funding Thresholds, Reliability and Risk Bands. The schemas for Launch Vehicles, Assets, Activities and kinds of research are in `assetSchemas.ts`, the Crewed Mission's in `crewSchema.ts`, and the fields more than one of them shares, such as an id, money and Technology Readiness, in `schemaFields.ts`. A new field goes in the schema file for its data file. A check that needs another file goes in the cross-check for its subject, or, for a new subject such as Technology, in a new file beside them, added to the `crossChecks` list in `catalogue.ts`.

| File                         | What it cross-checks                                                                                                                                                                                                                                              |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `crossCheckIds.ts`           | That each id is used once in its file                                                                                                                                                                                                                             |
| `crossCheckMissionEvents.ts` | The Mission Events that Launch Vehicles, Assets and Contingencies refer to, one Contingency per event, none timed from leaving Mars on the way there, and each Launch Vehicle's days near Earth                                                                   |
| `crossCheckHazards.ts`       | Dust storms and solar particle events against the Turn and the Trajectories                                                                                                                                                                                       |
| `crossCheckAssets.ts`        | Assets: Mission Events that need a Landing Site, Landing Sites, Activities, Service Life and that a fuel plant and a habitat land                                                                                                                                 |
| `crossCheckMilestones.ts`    | Milestones that can be earned, and Funding Thresholds in ascending order                                                                                                                                                                                          |
| `crossCheckReliability.ts`   | Reliability levels in order, and Risk Bands that cover every failure probability                                                                                                                                                                                  |
| `crossCheckTrajectories.ts`  | Trajectories and Free-returns that finish within a Turn                                                                                                                                                                                                           |
| `crossCheckTechnology.ts`    | Technology Readiness: unproven costs and risks, Development, and ids unique across Assets and Launch Vehicles                                                                                                                                                     |
| `crossCheckBenefits.ts`      | Benefits between Assets: that each has something to raise, and that a Mars lab lands and raises kinds of Asset that land                                                                                                                                          |
| `crossCheckSamples.ts`       | Sample return: Sample caching at a Landing Site, an ascent vehicle that lands and an Earth return orbiter that doesn't, each with the other to meet, and a First sample returned Milestone that can be earned                                                     |
| `crossCheckCrew.ts`          | The Crewed Mission: its Mission Events to Mars orbit, to a Landing Site and home from a round trip, with Mars ascent before it, within a Turn, the return vehicle's to Mars orbit and its room for Crew, Crew sizes in order, Activities, Health and enough names |

### The Simulation's files

Everything outside `src/simulation` reaches the rules through `createSimulation` in `simulation.ts`. A Turn runs in this order:

1. `workOutTurn.ts` checks the plan with `planCheck.ts` and flies the Mission with `flyMission.ts`, which works out each subject of the flight in its own module: solar particle events, go/no-go checks, Contingencies, Mission Events that fail and the Crew's Health on the way.
2. `turnSteps.ts` carries out the rest of the Turn's steps, in `resolveTurn`: Milestones for arriving and for a first landing (`arrivals.ts`), technologies that became Flight-proven (`flightProven.ts`), Development started and finished (`development.ts`), Assets and Crew at work (`assetsInService.ts`, `crewAtMars.ts`), dust storms (`dustStorms.ts`), the journey home of any Crew coming home (`journeyHome.ts`) or of samples sent home (`sampleReturn.ts`), the award for those who get home (`crewHome.ts`), the samples cached and those that reached Earth (`sampleCaching.ts`, `samplesHome.ts`), Surveys, ascent propellant (`ascentPropellant.ts`), the Supplies kept in habitats (`habitats.ts`), Ongoing Research (`ongoingResearch.ts`), Science Milestones (`scienceMilestones.ts`), Funding Thresholds and the fading of Public Support (`fundingThresholds.ts`). It builds the next Program, the Timeline and the Turn summary.
3. `workOutTurn.ts` stops at the earliest Decision Point that has no answer, from the Mission, a dust storm or the journey home, of Crew or samples, and gives the Timeline up to it.

- `simulation.ts`: The Simulation's interface, `createSimulation`, which hands each part to the modules below: starting, saving and restoring a Program, what the player sees of it, previews, and working out or running a Turn
- `programView.ts`: A new Program, and what the player sees of a Program between Turns
- `missionPreviews.ts`: What Planning Mode shows of a Mission before it launches: its Mission Events, Assets, Trajectories and Crew, with research raised by any Benefit
- `workOutTurn.ts`: Working out a Turn: checking the plan, flying the Mission, the rest of the Turn, and stopping at the earliest Decision Point with no answer
- `types.ts`: The shapes the Simulation takes and gives: plans, the Program and what the player sees of it, and Decision Points
- `previews.ts`: The shapes of what Planning Mode shows of a Mission before it launches: its Assets, Mission Events, Trajectories, Activities and Developments, and what a plan costs and weighs
- `turnSummary.ts`: The Turn summary: what changed over a Turn
- `timeline.ts`: The Timeline: what happened in a Turn, as Mission Mode plays it
- `rules.ts`: `createRules`: looking things up in the Catalogue, such as the Trajectory or Mission Events a Mission has, the day of a Mission Event, timed from launch, departure, arrival or leaving Mars, and failure chances; plus `roll`
- `planCheck.ts`: What a plan costs and weighs, and what's wrong with it, if anything
- `flyMission.ts`: The Turn's Mission: rolls its Mission Events in order, calling the modules below for each subject of the flight
- `flight.ts`: The Mission in flight, which those modules share: what it carries, where it's going, the day of each of its Mission Events, and its outcome so far. Its `leavesMarsOn` is the day a journey home leaves Mars, which Mission Events timed from leaving Mars count from, and is null for the Mission to Mars
- `goNoGo.ts`: The go/no-go check before a landing in a dust storm: going ahead, or holding off
- `contingency.ts`: The Contingency for a Mission Event that fails: its Decision Point, and the rescue
- `missionEventFailure.ts`: A Mission Event that fails for good: what it loses and costs, or a Free-return bringing the Mission home
- `missionReport.ts`: How the Turn's Mission shows on the Timeline, also up to a Decision Point, and in the Turn summary
- `technologyReadiness.ts`: Technology Readiness in a Program: whether a technology is Flight-proven, what it costs and how much it raises failure probabilities
- `flightProven.ts`: The technologies a Mission used successfully for the first time, which become Flight-proven
- `development.ts`: Development: the technologies that need it, starting it in a plan, and what finishes when
- `turnSteps.ts`: The steps of a Turn after the Mission, in order (above), and the next Program, Timeline and Turn summary
- `arrivals.ts`: What the Turn's Mission earns by arriving: Milestones for the first of each kind of Asset, a first landing and the first Crew at Mars and on the surface, and first-landing Science
- `assetsInService.ts`: Which Assets operate for which days of the Turn, their failures and end of Service Life, Surveys, and how the Assets at Mars show in Mission Mode
- `upkeep.ts`: Upkeep: what each Asset at Mars costs for a Turn, and the Assets whose missions a plan ends
- `baseFunding.ts`: Base funding: what the Program's backers pay as a Turn ends, for its Public Support
- `fundingThresholds.ts`: Funding Thresholds paid as a Turn ends, and the fading of Public Support
- `ongoingResearch.ts`: What each Activity earns in Science, Public Support and Research Grants, with the Research Grants a Mars lab raised
- `benefits.ts`: Benefits between Assets: the days on which they raise something, and by how much, including the days a Mars lab raises Research Grants at its Landing Site
- `marsLabs.ts`: What a Mars lab would add to the Research Grants at a Landing Site this Turn, for Planning Mode's Benefit tag
- `benefitImpact.ts`: What a Benefit would add this Turn, for Planning Mode's Benefit tag, which `src/planning/benefitImpactText.ts` puts into words
- `crew.ts`: Crew in planning: Crew sizes, the names Crew are given, their shared Activity in each place, and what's wrong with a plan's Crew
- `crewPlaces.ts`: Where Crew are: Mars orbit or a Landing Site, each a place of its own, and which of the Program's Crew are at Mars
- `crewView.ts`: What Planning Mode shows of Crew: those at Mars, what a Crewed Mission offers, and a Mission's Crew before it launches
- `crewAtMars.ts`: Crew during a Turn: arriving in Mars orbit or at a Landing Site, the Crew at work in each place, the Health and shared Supplies they use there, dying when Health runs out, and leaving for home with their share of the Supplies
- `ascentPropellant.ts`: Ascent propellant: what each fuel plant makes at its Landing Site on the days it operates, less any spent sheltering, what Mars ascent uses up there, the propellant at each site as the Turn ends, and how Planning Mode describes what a fuel plant makes
- `habitats.ts`: Habitats: the days each houses the Crew at its Landing Site, slowing their time at Mars, the Supplies they hold and share with the Crew there, what they hold as the Turn ends, and how Planning Mode describes a habitat and the days it would add
- `earthReturnStages.ts`: Earth return stages: what a round trip leaves in Mars orbit with its Crew, or a return vehicle for Crew already there, in orbit or at a Landing Site, the ways home Planning Mode offers, with why Crew at a site without enough ascent propellant can't take theirs, the journey home a plan chooses, and the stages left as a Turn ends
- `returnVehicles.ts`: Return vehicles: which Crew at Mars have no way home, what a return vehicle for them costs and weighs and what's wrong with one, the Earth return stage it leaves in Mars orbit for them when it gets there, and how that shows in the events column and the Turn summary
- `homeward.ts`: What Crew and samples coming home share before they fly: the days a journey home leaves Mars and gets home, and how a plan names a Landing Site's samples to send them home
- `homewardFlight.ts`: What a journey home of Crew or samples flies as: the parts of its `Flight` they share, its Mission Events flown in turn, each with their Reliability and Contingencies, and their text, which names what they carry (`homewardText`)
- `journeyHome.ts`: The journey home: round-trip Crew leaving Mars as a `Flight` of their own, through Mars ascent and the rendezvous with their Earth return stage if they leave a Landing Site, then the Mission Events of the way home, the ascent propellant Mars ascent used, and what the way home does to their Health and Supplies
- `sampleCaching.ts`: Sample caching: the samples each Asset on it caches at its Landing Site on the days it does it, what each site holds from Turn to Turn, and what Planning Mode says it collects
- `sampleReturn.ts`: Sending samples home: the choices Planning Mode offers for each Landing Site with samples, with why they can't go yet, the ascent vehicle and Earth return orbiter that fly them as a `Flight` of their own through the journey home's Mission Events, with what their Missions bought, and those two leaving Mars
- `samplesHome.ts`: Samples reaching Earth, aboard an Earth return orbiter or with Crew coming home from a Landing Site with samples of their own: the Science each earns, the First sample returned Milestone, and what is left at each site
- `crewHome.ts`: Crew home safe, from a journey home or a Free-return: the Public Support each earns and the First Crew home Milestone
- `crewAtMarsReport.ts`: How the Crew at Mars show to the player: in the events column, in Mission Mode's views and in the Turn summary
- `supplies.ts`: Supplies: what a Crewed Mission carries, how a store of them is used each day and runs out, and when they ran out this Turn
- `health.ts`: Crew Health: what lowers it, by cause, over days and all at once, the day it runs out, and what Protection and a habitat saved
- `protection.ts`: Protection: the level a Crewed Mission carries, which each Crew member keeps, and how much it slows radiation
- `crewHealthInFlight.ts`: What the flight did to the Crew's Health and Supplies once the Mission has flown, losing those whose Health ran out on the way
- `lostCrew.ts`: Crew who leave for good: losing Crew, whatever the cause, with the Public Support it costs, and the records of Crew who get home
- `scienceMilestones.ts`: The day a total of Science or Public Support is reached, for Science Milestones and Funding Thresholds
- `dustStorms.ts`: Dust storms over Landing Sites and the Assets and Crew there, and sheltering or carrying on
- `solarParticleEvents.ts`: Solar particle events on the way to Mars, safe mode or carrying on, and what they do to the Mission and its Crew in flight
- `saveFormat.ts`: Each released save format and how to upgrade it to the next
- `testCatalogue.ts`, `testActivities.ts`, `testMissionEvents.ts`, `testTechnology.ts`, `testCrew.ts`, `testHelpers.ts`, `scienceTestHelpers.ts`: Fixtures and helpers for the rule tests, with the test catalogue's Activities, its Mission Events and Contingencies, its unproven, not-built and refuelled technologies, and its Crewed Mission in files of their own

A new rule usually goes in the file for its step of the Turn, or a new file beside them for a new Hazard, called from `turnSteps.ts` if it happens at Mars and from `flyMission.ts` if it happens to the Mission, taking the `Flight` from `flight.ts`. Its tests go in a test file named after the rule. A new Hazard usually also needs a Decision Point kind and its answers in `types.ts`, its part of the Turn summary in `turnSummary.ts`, an entry for it in `timeline.ts`, a cautious answer in `workOutTurn.ts`, and switching off in `calmCatalogueFiles` in `src/testing/realCatalogue.ts`, so that tests of the rest of the balance aren't disturbed by it.

### Balance runs

To check the balance without playing, run this from the repository root:

```powershell
npm.cmd run balance
```

It plays every strategy listed in `src/balance/strategies.ts` against the real data files, with no browser, for up to 20 Turns each on seeds 1 to 1000, and prints the report. That takes about half a minute. For a quick pass, use `npm.cmd run balance -- --programs 200`. The same command always gives the same report, so two runs can be compared line by line, for example before and after changing `public/data`. The results inform tuning and don't fail anything: the only part that can fail a build is the invalid-state test in `src/balance/balanceRuns.test.ts`, which plays a few Programs on each strategy. The command also stops with an error if a plan fails validation or a Turn leaves an invalid state.

The report explains its own tables: a legend at the top covers the summary and Turn table columns, each section opens with what it counts, and each strategy's section starts with what that strategy does. Its Coming Home section says how the report decides when a Program keeps itself going, which is `keepsItselfGoingFrom` in `src/balance/comingHomeReport.ts`, also used by the tests of the tuned balance. The report is put together in `src/balance/report.ts`, with its Technology section in `technologyReport.ts`, its Crew section in `crewReport.ts`, its Coming Home section in `comingHomeReport.ts`, and the lines of each strategy's section on what a base at Mars did and what came home in `baseReport.ts`.

Strategies are simple on purpose, so a difference between two of them is only a rough guide to what a thoughtful player would find. To judge one choice, compare two strategies that differ only in it:

- The ones named `steady:` each differ from `steady: Soil analysis` in one choice. For a Decision Point answer, compare `steady: Soil analysis` with `steady: carry on through storms`.
- Programs that develop tend to be the ones already doing well, so judge a Development by whole strategies, such as `steady: develop the Endurance Rover when rich` against `steady: Soil analysis`, not by the Technology section's split by whether a Program started one.
- Each strategy that varies another starts its description by naming it ("As …", or "The same" for the one listed just before it), so compare those two. Descriptions are passed to `playStyle` in `steadyStrategies.ts` and `bigProgramStrategies.ts`, and the report prints each at the top of its strategy's section. Crew play is in `src/balance/crewPlay.ts`.
- `playProgram.ts` checks every Turn for invalid states: general ones in `invalidStates.ts`, and one file per subject: `invalidCrew.ts` for Crew, `invalidHomecomings.ts` for Crew coming home, `invalidPropellant.ts` for ascent propellant, `invalidFetching.ts` for fetching Crew with a return vehicle, `invalidHabitats.ts` for habitats, `invalidLabs.ts` for Mars labs and `invalidSamples.ts` for samples.

The last strategy, `tutorial: build a Base, land Crew there and bring them home`, is the tutorial's advice from `src/tutorial`, followed every Turn. Its section ends with how often it reached its goal, Crew at a Landing Site where a fuel plant, a Habitat and a Mars lab operate, and by which Turn, and how often it judged a Program unable to reach it ("Can't recover"), with how many of those went on to reach the goal anyway, as it plays on after that. A strategy reports these lines when it has a `goal`, and they are worked out in `goalReport.ts`. `src/catalogue/balanceTutorial.test.ts` holds that it reaches the goal in most Programs and that Can't recover rarely ends one that would have.

The strategies named `cautious` and `bold` are the yardsticks for how the game rewards risk: `src/catalogue/balanceBaseFunding.test.ts` holds that Cautious is rarely cancelled and recovers from a failed first Mission, and that Bold is cancelled often but is far ahead when it isn't. The play styles they and the others are built from are in `src/balance/styleParts.ts`.

To add a strategy, add an object to the `strategies` list in `strategies.ts`, or to `steadyStrategies.ts` or `bigProgramStrategies.ts` for one named `steady:` or `big Program:`, with no other change. The one exception is `steady: Survey once`, which the report has always listed after the `big Program:` ones, so `steadyStrategies.ts` exports it on its own, as `steadySurveyOnce`, and `strategies.ts` places it there. Its `plan(view, tools)` sees what a player sees: the `ProgramView`, the previews and `tools.problemsWith(plan)`. It returns a `TurnPlan`, which must pass validation, so it has to cope with shortages of money and with what's on offer changing. It can also have an `answer(decisionPoint, view)` for what it does at a Decision Point, and takes the first choice offered if it hasn't. The `playStyle` helper in `src/balance/playStyle.ts` covers the common case, with the choices it can make in `playStyleOptions.ts` and the Missions it builds for its Assets in `assetMissions.ts`, and pays Upkeep as `src/balance/upkeepPlay.ts` says: it keeps every Asset it can pay for, ending the missions of those with the least Service Life left when it can't, or when that frees the money for a launch while it is under its limit of Assets.

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
