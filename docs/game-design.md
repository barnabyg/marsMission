# Game design decisions

The game rules settled so far. This file says which are built and in what order the rest come, and the rules themselves are in [design/](design/), one file for each area, listed under [Rules by area](#rules-by-area). Most describe the finished game, so check Status below for what exists today. Current balance values, such as money, Public Support, Science and risk, live only in the data files in [public/data](../public/data), so any such figure here is an example, not the game's value. Vocabulary follows [GLOSSARY.md](../GLOSSARY.md); platform and fidelity decisions are in [docs/adr/](adr/). Items marked _open_ are still being decided.

## Status

Phases are defined in the [Build order](#build-order). Phases 1 to 7 are built:

- **Phase 1:** Turns running from one Launch Window to the next, with at most one Mission each; Assets that stay operating at Mars; Mission Events listed from what a Mission carries; Planning Mode with one Launch Vehicle and one orbiter; Mission Mode with the solar system view, speed controls and text screens; Science, Milestones, Funding Thresholds, the Public Support drain and Cancellation Level; retiring a Program and the Program summary; tooltips.
- **Phase 2:** Mission Event failure with Risk Bands; Reliability; the fixed random seed; automatic saves and manual save slots; the first sound effects.
- **Since the Phase 2 playtest:** Save, Load and Retire Program dialogs in Planning Mode; text sized for 150% display scaling; Pause in Mission Mode; the events column in place of Phase 1's text screens.

- **Phase 3:** a lander and entry/descent/landing; Landing Sites, each with a landing risk and a Science value earned by the first landing there; Missions carrying several Assets within a Launch Vehicle's mass limit, with a second, larger Launch Vehicle brought forward from Phase 6; partial Mission failure, where Assets already delivered are safe; automatic Surveys from orbit; a Service Life chosen for each Asset; Assets failing in service, with Reliability bought for each Asset; a second Funding Threshold; the Mars orbit view, with automatic view changes and smooth camera moves. Saves upgrade step by step from any earlier format.
- **Since the Phase 3 playtest:** End Turn in Mission Mode.

- **Phase 4:** Activities, with Survey, research and Nothing as the first ones; Ongoing Research, which also adds a little Public Support; Research Grants, which take over from Funding Thresholds as the main income of a Program that keeps Assets at Mars; a rover, choosing between Science and money; Science Milestones and more Funding Thresholds; the surface view, with generated terrain, landing and crash sequences it moves to by itself, and rovers that move according to their Activity; automated balance runs, and the numbers tuned with them, including longer Service Lives.

- **Phase 5:** Decision Points, with no time limit and End Turn stopping at each one; Contingency, a gamble bought in Planning Mode and used for a second roll when its Mission Event fails; Slow, Fast and Free-return Trajectories; dust storms and solar particle events, the first Hazards; go/no-go checks before a landing in a dust storm; the spacecraft view, which Mission Mode moves to for a solar particle event or a failed Mars transfer burn; the balance report on Decision Points, and the numbers tuned with it. With no Crew yet, a solar particle event harms hardware, costing Service Life or losing the Mission, and Protection waits for Phase 7; holding off a landing costs Service Life, as there are no Supplies to spend.

- **Phase 6:** Technology Readiness on every Asset and Launch Vehicle, and Flight-proven status, with the Pinpoint Lander, built but not yet flown, as the first technology that starts unproven; Development, with the Endurance Rover as the first technology that needs it; the Meridian Colossus, a Launch Vehicle that needs Development and carries the most mass, but only with Orbital refuelling, whose Tanker launch and Rendezvous are Mission Events, shown in Earth orbit in the spacecraft view, which Mission Mode moves to for the Rendezvous; the Courier Relay, a relay orbiter whose Benefit, the first between Assets, raises the Ongoing Research of everything on the surface; tooltips for every new term; the balance report on technology, with strategies that develop technology and ones that keep to what is Flight-proven, and the numbers tuned with it. In Phase 6 the Meridian Colossus didn't earn its place: a Mission can't carry two of the same Asset, so few Missions need more than the Meridian Heavy carries, and in the balance runs filling the Meridian Heavy did better than developing the Meridian Colossus. Phase 7 gives it a Mission that needs it.
- **Since the Phase 6 playtest:** a Mission that starts each Turn with no Asset chosen, with a tag on each Asset already operating at Mars.

- **Phase 7:** Crewed Missions to Mars orbit, with a Crew size chosen in Planning Mode, too heavy for any Launch Vehicle but the Meridian Colossus; named Crew who arrive in Mars orbit and stay there, sharing one Activity and earning Ongoing Research; Health, which radiation on the way and at Mars, time at Mars and Contingency rescues lower, so that Crew at Mars die there in the end; the First Crew at Mars Milestone; a balance strategy that flies Crew; losing Crew to a failed Mission Event, including a failed launch, or to a solar particle event that loses the Mission, with a large drop in Public Support; a Free-return bringing Crew home alive; Crew landing at a Landing Site, with its first-landing Science and the First Crew on the surface Milestone, earning research there that a Benefit raises, and facing dust storms there, which can cost them Health; a balance strategy that lands Crew; Supplies chosen for each Crewed Mission, used from launch and shared by the Crew in each place at Mars, whose running out lowers Health quickly and can lose Crew, and which holding off a landing uses for each day held; Protection bought for each Crewed Mission, which slows the Health its Crew lose to radiation on the way, in a solar particle event and at Mars, with the Health it saved in the Turn summary; solar particle events that cost Crew aboard Health, less in safe mode, with a row of their own in the balance report. Mission Mode shows the Crew's ship with a model of its own in each view, and Crew landings and crashes as sequences of their own; Crew at a Landing Site work outside it as their Activity has them do, and losing Crew plays a sound of its own. Tooltips cover every new term, and the balance report has a section on Crew: the Crewed Missions flown, the Crew lost by cause and brought home, and how Programs ended according to whether they flew Crew, with strategies that fly Crew and ones that stay robotic, and the numbers tuned with it. The Meridian Colossus now earns its place: in the balance runs, a big Program that develops it and lands Crew does better than one that fills the Meridian Heavy, while Crew kept in Mars orbit don't pay for themselves.

- **Since the Phase 7 playtest:** Restart Program in place of Retire Program, starting a new Program straight away; an Asset or Crewed Mission that wouldn't fit or can't be afforded can't be ticked; what the Turn will spend, and what it leaves, beside the Money at the top of Planning Mode; every Reliability choice in the Mission Events step, the Mission Events' on the way and then each Asset's in service at Mars; Upkeep for each Asset kept at Mars, and ending an Asset's mission to stop it; base funding each Turn, sized by Public Support, so that a failed Mission is a setback rather than the end, with cautious and bold strategies in the balance runs to measure how the game rewards risk; a cheaper Courier Relay, with its Benefit tag showing the Science it would add this Turn.

- **Phase 8, so far:** round trips for Crew in Mars orbit, with an Earth return stage that brings them home on a later Turn through the journey home's own Mission Events; Public Support for every Crew member home safe, from a journey home or a Free-return, and the First Crew home Milestone; a balance strategy that brings Crew home.

Any rule in the design files beyond these is planned, so its absence from the code isn't a bug.

## Rules by area

- [Program, Turns and starting conditions](design/program.md)
- [Assets and Landing Sites](design/assets.md)
- [Risk and Safety Margin](design/risk.md)
- [Mission Mode, saving, art and sound](design/mission-mode.md)
- [Science, Public Support and money](design/science-and-money.md)
- [Crew](design/crew.md)
- [Technology](design/technology.md)

## Build order

The aim is to get something playable as early as possible, so the player can give feedback. The simulation starts thin and grows alongside the game instead of being finished first.

The work is split into phases, each ending in a game the player can play and comment on. Phases after the current one can change with playtest feedback.

1. **First Orbiter:** the Turn loop with one orbiter, the solar system view, money, Science and Public Support.
2. **Things Go Wrong:** Mission Event failure, Reliability, the fixed random seed, saving and the first sound effects.
3. **Landing on Mars:** a lander, Landing Sites and Surveys, mass limits, the Mars orbit view and Service Life.
4. **Doing Science:** a rover, the surface view, Activities, Ongoing Research, Research Grants and automated balance runs.
5. **Tough Choices:** Decision Points, Contingency, Hazards, go/no-go checks, Trajectories and the spacecraft view.
6. **Better Technology:** Technology Readiness, Development, Flight-proven status, more Launch Vehicles and benefits between Assets.
7. **First Crew:** Crewed Missions, Crew and Health, Supplies and Protection, with a Crewed Mission too heavy for the Meridian Heavy, so that the Meridian Colossus earns its place.
8. **Coming Home:** return journeys, returning samples, a fuel plant, a habitat and a Mars lab.
