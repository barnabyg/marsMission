# Game design decisions

The game rules settled so far, grouped by area. Most describe the finished game, so check Status below for what exists today. Current balance values, such as money, Public Support, Science and risk, live only in the data files in [public/data](../public/data), so any such figure here is an example, not the game's value. Vocabulary follows [GLOSSARY.md](../GLOSSARY.md); platform and fidelity decisions are in [docs/adr/](adr/). Items marked _open_ are still being decided.

## Status

Phases are defined in the [Build order](#build-order). Phases 1, 2 and 3 are built:

- **Phase 1:** Turns running from one Launch Window to the next, with at most one Mission each; Assets that stay operating at Mars; Mission Events listed from what a Mission carries; Planning Mode with one Launch Vehicle and one orbiter; Mission Mode with the solar system view, speed controls and text screens; Science, Milestones, Funding Thresholds, the Public Support drain and Cancellation Level; retiring a Program and the Program summary; tooltips.
- **Phase 2:** Mission Event failure with Risk Bands; Reliability; the fixed random seed; automatic saves and manual save slots; the first sound effects.
- **Since the Phase 2 playtest:** Save, Load and Retire Program dialogs in Planning Mode; text sized for 150% display scaling; Pause in Mission Mode; the events column in place of Phase 1's text screens.

- **Phase 3:** a lander and entry/descent/landing; Landing Sites, each with a landing risk and a Science value earned by the first landing there; Missions carrying several Assets within a Launch Vehicle's mass limit, with a second, larger Launch Vehicle brought forward from Phase 6; partial Mission failure, where Assets already delivered are safe; automatic Surveys from orbit; a Service Life chosen for each Asset; Assets failing in service, with Reliability bought for each Asset; a second Funding Threshold; the Mars orbit view, with automatic view changes and smooth camera moves. Saves upgrade step by step from any earlier format.

Any rule in this document beyond these is planned, so its absence from the code isn't a bug.

## Program and Turns

- A Program is open-ended. In practice it winds down when the player runs out of worthwhile things to build or do.
- A Program ends when the player retires it or when Public Support falls below the Cancellation Level and it is cancelled. Either way, a Program summary shows total Science and the Milestones achieved.
- A late-game goal is to build up enough that the Program carries on indefinitely, producing enough money and Public Support with little input from the player.
- At most one Mission is launched per Turn, as a single journey. This keeps Mission Mode buildable.
- A Mission ends when it has delivered its Assets and Crew, or has failed. After that they operate at Mars on their own, so Mission Mode shows the Turn's Mission plus everything already operating.
- If assembling or refuelling in Earth orbit needs several launches, those launches and rendezvous are Mission Events within the one Mission.
- The Launch Vehicle is chosen from the catalogue and sets how much mass the Mission can carry.
- Each Mission picks one of 2–3 fixed Trajectories, such as Slow (least fuel, longest Duration), Fast (more fuel and mass, less radiation for Crew) or Free-return (swings back to Earth if the arrival burn fails, at the cost of flexibility).
- Missions can go to Mars orbit or to a Landing Site. Phobos and Deimos are left out of the first version.
- In Planning Mode the player gives each Asset one Activity for the Turn. Crew at one Landing Site share one Activity.
- Each Turn begins at a Launch Window (roughly every 26 months) and consists of Planning Mode followed by Mission Mode.
- No game time passes in Planning Mode. Mission Mode runs from one Launch Window to the next, showing every Mission in flight and every operating Asset together. Mission Events don't hold game time; Decision Points pause play.
- Missions can overlap Turns. For example, a Crewed Mission that stays on the surface for a long time lasts about 2.5 years, so the next Turn's Planning Mode happens while Crew are still at Mars.
- Doing everything in a single Mission ("one jump") is possible but very expensive and risky. Building up Assets over several Turns is the intended cheaper path.
- Robotic and Crewed Missions are both available. Crewed Missions cost much more and earn more Public Support.

## Assets

- Players choose pre-designed Assets from a catalogue. There is no assembly from parts.
- Assets stay at Mars and keep working into later Turns, within reason: each has a limited Service Life, and longer Service Life costs more.
- An Asset may fail before its Service Life ends, in any Turn after the one it arrives in. This is a probability that Reliability lowers, bought separately for each Asset. For now it costs no Public Support, which playtesting may change.
- No repairs or Service Life extensions in the first version.
- Assets give each other a limited set of specific benefits, defined in the catalogue. For example, a relay orbiter raises the Ongoing Research rate of everything on the surface, a fuel plant makes a return journey possible and a habitat lets Crew stay longer.
- A spacecraft that can make the round trip costs more than a one-way one.

## Landing Sites

- Mars has named Landing Sites. Each has a landing risk and a Science value, earned by the first successful landing there. Resources such as water ice are left out until a rule uses them.
- Apart from the two starting sites, Landing Sites become available only through a Survey from orbit. Surveying also lowers a site's landing risk.
- For now, Surveying is automatic rather than an Activity. In each Turn a surveying Asset operates at Mars, every known site drops to its surveyed risk in one step, and the next site in the catalogue becomes known. A second surveying Asset doesn't speed this up.

## Risk and Safety Margin

- Each Mission is a sequence of Mission Events, and each Event has a failure probability.
- An Asset is delivered when its last Mission Event succeeds. When a Mission Event fails, Assets already delivered are safe and everything else is lost. A lander alone goes straight to entry/descent/landing, so carrying an orbiter as well is cheaper than two Missions but exposes the lander to orbit insertion.
- The game builds the list of Mission Events automatically from what the Mission carries. A lander adds entry/descent/landing, and orbital refuelling adds a rendezvous. The player then buys Safety Margin against that list.
- Safety Margin comes in three kinds:
  - Reliability (testing, redundancy) lowers an Event's failure probability.
  - Contingency (escape module, abort fuel) changes the outcome when an Event fails. Decision Points are often where a Contingency is used.
  - Protection (radiation shielding) reduces harm to Crew that builds up over the Mission's Duration.
- All Safety Margin is worth having but expensive.
- Failure probabilities are shown to the player as rough bands (for example "~5%"), not exact figures.
- The random seed is fixed when the Program starts, so the same plan gives the same outcome after a reload. A changed plan can avoid a failure already seen, for example by buying more Reliability or by not launching. _Open: whether to keep this gap is to be settled by playtest feedback._
- Mission Mode also has Hazards: random environmental dangers such as dust storms (less solar power, risk to Assets) and solar particle events (radiation, reduced by Protection). They are separate from planned Mission Events and can create Decision Points.

## Mission Mode

- A Turn takes about 20 minutes at 1x speed, with controls to speed it up to 5x or 10x, or to pause it. Pausing only affects how a Turn is shown and lasts only for that Turn, because choosing a speed is what ends it and the next Turn starts at the speed last chosen.
- The graphics are a mix of pre-made animations (such as an asteroid strike on a base) and displays (such as orbital tracking of a journey).
- Pre-made animations are scripted 3D sequences that run live in the game, not pre-rendered video, so they show the Assets the player actually bought at the Landing Site they actually chose.
- The first animation goal is one success and one failure animation per kind of Mission Event, and one per Hazard. More will follow. Each Mission Event, Milestone and Funding Threshold is added to an events column beside the view when it happens, with its date, title and description, newest at the top, and stays until the Turn ends. Nothing needs dismissing and time keeps running, so the player pauses to read. A failure stands out in the failure colour and plays its sound.
- Decision Points come from three triggers:
  - A Mission Event fails and a Contingency the player bought can be used.
  - A Hazard hits.
  - A go/no-go check before a high-risk Mission Event, where the player can hold off (for example, delay a landing until a dust storm passes, at a cost in Supplies or Service Life).
- Play pauses at each Decision Point with no time limit.
- Mission Mode has four views, with smooth camera transitions between them:
  - Solar system: Earth, Mars and the transfer route.
  - Mars orbit: orbiting Assets, arrival, aerocapture.
  - Surface: a Landing Site, with landings, rovers and bases.
  - Spacecraft: a close-up of the Mission in transit, used when something happens on the way, such as a solar particle event or a mechanical failure.
- The view switches automatically for Mission Events and Hazards, and the player can switch views at any time.

## Art, sound and onboarding

- Mars and the planets use NASA's public imagery and elevation data. Spacecraft use NASA's free 3D models where they fit, plus simple models made for the project. Plumes, dust and explosions are generated in code. Licensing rules are in [ADR 0005](adr/0005-free-open-licensed-media-only.md).
- The first version has simple sound effects and no music.
- There is no guided tutorial in the first version. Every term has a tooltip instead, except in button labels.

## Build order

The aim is to get something playable as early as possible, so the player can give feedback. The simulation starts thin and grows alongside the game instead of being finished first.

The work is split into phases, each ending in a game the player can play and comment on. Phases after the current one can change with playtest feedback.

1. **First Orbiter:** the Turn loop with one orbiter, the solar system view, money, Science and Public Support.
2. **Things Go Wrong:** Mission Event failure, Reliability, the fixed random seed, saving and the first sound effects.
3. **Landing on Mars:** a lander, Landing Sites and Surveys, mass limits, the Mars orbit view and Service Life.
4. **Doing Science:** a rover, the surface view, Activities, Ongoing Research, Research Grants and automated balance runs.
5. **Tough Choices:** Decision Points, Contingency, Hazards, go/no-go checks, Trajectories and the spacecraft view.
6. **Better Technology:** Technology Readiness, Development, Flight-proven status, more Launch Vehicles and benefits between Assets.
7. **First Crew:** Crewed Missions, Crew and Health, Supplies and Protection.
8. **Coming Home:** return journeys, returning samples, a fuel plant, a habitat and a Mars lab.

## Saving

- The game saves automatically at the start of each Planning Mode.
- A few manual save slots are available, usable only in Planning Mode. Saving partway through Mission Mode isn't possible, so a reload always returns to the start of a Turn. What that can and can't undo is under [Risk and Safety Margin](#risk-and-safety-margin).

## Science

- Science is the score. It is weighted heavily towards activity at Mars itself, for example 100 for an orbiter surveying landing sites and 1000 for returning samples to Earth.
- Science comes from two sources:
  - Milestones: one-off achievements, such as returning a sample.
  - Ongoing Research: a steady rate earned only while an Asset or Crew is actively doing the work, such as analysing fresh soil samples in a lab on Mars. The rate doesn't decline over time.
- Science already earned is never taken away.
- Some Science pays a Research Grant at the start of the next Turn. Only certain research qualifies, at a rate set for each kind, and early-game research pays little or nothing. Late in a Program, Research Grants are the main income and Public Support matters less. Like a rover mission, public excitement peaks early and fades while the Science carries on.

## Public Support and money

- Milestones award Public Support points.
- When Public Support reaches a Funding Threshold, it pays a fixed sum. For example, 100 points plus 200 for putting an orbiter at Mars would cross a 250-point threshold, which might pay $1 billion.
- Each Funding Threshold pays only the first time it is reached. Falling below and climbing back pays nothing.
- There is no regular Appropriation. Running out of money through poor management is a way for the player to fail.
- There is no separate bankruptcy rule. A player with no money lets Turns pass without launching, and Public Support drains until the Program is cancelled, unless what they've built keeps it going. Cancellation is the only way to lose.
- Funding Thresholds are a fixed, limited list, mainly an early and mid-game boost.
- Public Support falls by a percentage each Turn (for example 15%), so spikes fade fast and then level off. The Program is cancelled if it drops below the Cancellation Level (for example 50). Ongoing Research adds a small, steady amount, enough for a productive Program to stay above the Cancellation Level but not enough to keep reaching new Funding Thresholds. _To be checked in playtesting._
- Costs are in millions of dollars, at roughly real-world scale. For example: orbiter $0.5–1B, lander $1–2.5B, Crewed Mission $50B and up.

## Starting conditions

- The Program starts at the late-2028 Launch Window. Its starting money and Public Support, in [public/data/program.json](../public/data/program.json), are set so that a first orbiter reaches the first Funding Threshold, and so that the player can afford an orbiter or a lander and a retry if it fails, with a little left for Reliability. A first orbiter followed by a first landing, in either order, reaches the second Funding Threshold.
- Two well-known Landing Sites (for example Jezero and Gale) are available from the start, at high landing risk because they haven't been surveyed. The first Turn is a choice between surveying first and landing straight away.
- No difficulty levels in the first version.

## Crew

- Crew are named, with no individual traits apart from Health.
- The player chooses the Crew size for each Mission, trading more mass and Supplies against more research.
- Losing Crew causes a large drop in Public Support. The only Science cost is that the Ongoing Research they were doing stops.
- Crew don't have to come home. Staying at Mars harms them through radiation and other effects.
- Bringing Crew home safely earns a large amount of Public Support. Every safe return earns it, and the first return is also a Milestone worth more.
- A later Mission can fetch Crew already at Mars if it carries a return vehicle.
- Each Crew member has a single Health value. Radiation, time at Mars and failed Mission Events lower it, Protection slows the decline, and at zero they die.
- Crew need Supplies. When Supplies run out, Health falls quickly.

## Technology

- Every technology is visible from the start, labelled with its Technology Readiness. The best technology takes development time and money before it can fly, and is less reliable until it has flown successfully.
- Development is paid for up front in Planning Mode and takes a set number of Turns. After its first successful use, a technology is Flight-proven: cheaper and more reliable.
