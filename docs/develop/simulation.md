# The Simulation's files

Part of the developer docs; [README.md](../../README.md) has the code map, the commands and the checks.

Everything outside `src/simulation` reaches the rules through `createSimulation` in `simulation.ts`. A Turn runs in this order:

1. `workOutTurn.ts` checks the plan with `planCheck.ts` and flies the Mission with `flyMission.ts`, which works out each subject of the flight in its own module: solar particle events, go/no-go checks, Contingencies, Mission Events that fail and the Crew's Health on the way.
2. `turnSteps.ts` carries out the rest of the Turn's steps, in `resolveTurn`: Milestones for arriving and for a first landing (`arrivals.ts`), technologies that became Flight-proven (`flightProven.ts`), Development started and finished (`development.ts`), Assets and Crew at work (`assetsInService.ts`, `crewAtMars.ts`), dust storms (`dustStorms.ts`), the journey home of any Crew coming home (`journeyHome.ts`) or of samples sent home (`sampleReturn.ts`), the award for those who get home (`crewHome.ts`), the samples cached and those that reached Earth (`sampleCaching.ts`, `samplesHome.ts`), Surveys, ascent propellant (`ascentPropellant.ts`), the Supplies kept in habitats (`habitats.ts`), Ongoing Research (`ongoingResearch.ts`), Science Milestones (`scienceMilestones.ts`), Funding Thresholds and the fading of Public Support (`fundingThresholds.ts`). It builds the next Program, the Timeline and the Turn summary.
3. `workOutTurn.ts` stops at the earliest Decision Point that has no answer, from the Mission, a dust storm or the journey home, of Crew or samples, and gives the Timeline up to it.

- `simulation.ts`: The Simulation's interface, `createSimulation`, which hands each part to the modules below: starting, saving and restoring a Program, what the player sees of it, previews, and working out or running a Turn
- `programView.ts`: A new Program, and what the player sees of a Program between Turns
- `missionPreviews.ts`: What Planning Mode shows of a Mission before it launches: its Mission Events, Assets, Trajectories and Crew, with research raised by any Benefit
- `workOutTurn.ts`: Working out a Turn: checking the plan, flying the Mission, the rest of the Turn, and stopping at the earliest Decision Point with no answer
- `types.ts`: The shapes the Simulation takes and gives: plans, the Program and what the player sees of it, and Decision Points
- `previews.ts`: The shapes of what Planning Mode shows of a Mission before it launches: its Assets, with what a longer Service Life adds, Mission Events, Trajectories, Activities and Developments, and what a plan costs and weighs
- `choiceText.ts`: How Planning Mode and the tutorial word what an Activity earns and what a longer Service Life adds against its cost and Upkeep, so that the tutorial quotes what the choices show
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

A new rule usually goes in the file for its step of the Turn, or a new file beside them for a new Hazard, called from `turnSteps.ts` if it happens at Mars and from `flyMission.ts` if it happens to the Mission, taking the `Flight` from `flight.ts`. Its tests go in a test file named after the rule. A new Hazard usually also needs a Decision Point kind and its answers in `types.ts`, its part of the Turn summary in `turnSummary.ts`, an entry for it in `timeline.ts`, a cautious answer in `workOutTurn.ts` and the tutorial's suggested answer in `src/tutorial/decisions.ts`, and switching off in `calmCatalogueFiles` in `src/testing/realCatalogue.ts`, so that tests of the rest of the balance aren't disturbed by it.
