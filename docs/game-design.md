# Game design decisions

The game rules settled so far, grouped by area. Vocabulary follows [GLOSSARY.md](../GLOSSARY.md); platform and fidelity decisions are in [docs/adr/](adr/). Items marked _open_ are still being decided.

## Program and Turns

- A Program is open-ended. In practice it winds down when the player runs out of worthwhile things to build or do.
- A Program ends when the player retires it or when Public Support falls to zero and it is cancelled. Either way, a Program summary shows total Science and the Milestones achieved.
- A late-game goal is to build up enough that the Program carries on indefinitely, producing enough money and Public Support with little input from the player.
- At most one Mission is launched per Turn, as a single journey. This keeps Mission Mode buildable.
- A Mission ends when it has delivered its Assets and Crew, or has failed. After that they operate at Mars on their own, so Mission Mode shows the Turn's Mission plus everything already operating.
- If assembling or refuelling in Earth orbit needs several launches, those launches and rendezvous are Mission Events within the one Mission.
- The Launch Vehicle is chosen from the catalogue and sets how much mass the Mission can carry.
- Each Mission picks one of 2–3 fixed Trajectories, such as Slow (least fuel, longest Duration), Fast (more fuel and mass, less radiation for Crew) or Free-return (swings back to Earth if the arrival burn fails, at the cost of flexibility).
- Missions can go to Mars orbit or to a Landing Site. Phobos and Deimos are left out of the first version.
- In Planning Mode the player gives each Asset one Activity for the Turn. Crew at one Landing Site share one Activity.
- Each Turn begins at a Launch Window (roughly every 26 months) and consists of Planning Mode followed by Mission Mode.
- No game time passes in Planning Mode. Mission Mode runs from one Launch Window to the next, showing every Mission in flight and every operating Asset together. Time speeds up and slows down automatically for Mission Events and Decision Points.
- Missions can overlap Turns. For example, a Crewed Mission that stays on the surface for a long time lasts about 2.5 years, so the next Turn's Planning Mode happens while Crew are still at Mars.
- Doing everything in a single Mission ("one jump") is possible but very expensive and risky. Building up Assets over several Turns is the intended cheaper path.
- Robotic and Crewed Missions are both available. Crewed Missions cost much more and earn more Public Support.

## Assets

- Players choose pre-designed Assets from a catalogue. There is no assembly from parts.
- Assets stay at Mars and keep working into later Turns, within reason: each has a limited Service Life, and longer Service Life costs more.
- An Asset may fail before its Service Life ends. This is a probability that Reliability lowers.
- No repairs or Service Life extensions in the first version.
- Assets give each other a limited set of specific benefits, defined in the catalogue. For example, a relay orbiter raises the Ongoing Research rate of everything on the surface, a fuel plant makes a return journey possible and a habitat lets Crew stay longer.
- A spacecraft that can make the round trip costs more than a one-way one.

## Landing Sites

- Mars has named Landing Sites. Each has a landing risk, a Science value and resources such as water ice.
- Apart from the two starting sites, Landing Sites become available only through a Survey from orbit. Surveying also lowers a site's landing risk.

## Risk and Safety Margin

- Each Mission is a sequence of Mission Events, and each Event has a failure probability.
- The game builds the list of Mission Events automatically from what the Mission carries. A lander adds entry/descent/landing, and orbital refuelling adds a rendezvous. The player then buys Safety Margin against that list.
- Safety Margin comes in three kinds:
  - Reliability (testing, redundancy) lowers an Event's failure probability.
  - Contingency (escape module, abort fuel) changes the outcome when an Event fails. Decision Points are often where a Contingency is used.
  - Protection (radiation shielding) reduces harm to Crew that builds up over the Mission's Duration.
- All Safety Margin is worth having but expensive.
- Failure probabilities are shown to the player as rough bands (for example "~5%"), not exact figures.
- The random seed is fixed when the Program starts, so reloading a save can't re-roll an outcome.
- Mission Mode also has Hazards: random environmental dangers such as dust storms (less solar power, risk to Assets) and solar particle events (radiation, reduced by Protection). They are separate from planned Mission Events and can create Decision Points.

## Mission Mode

- A Turn takes about 20 minutes at 1x speed, with controls to speed it up.
- The graphics are a mix of pre-made animations (such as an asteroid strike on a base) and displays (such as orbital tracking of a journey).
- Pre-made animations are scripted 3D sequences that run live in the game, not pre-rendered video, so they show the Assets the player actually bought at the Landing Site they actually chose.
- The first animation goal is one success and one failure animation per kind of Mission Event, and one per Hazard. More will follow. Anything without an animation yet shows a simple text message screen, built so an animation can replace it later.
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
- There is no guided tutorial in the first version. Every term has a tooltip instead.

## Build order

The aim is to get something playable as early as possible, so the player can give feedback. The simulation starts thin and grows alongside the game instead of being finished first.

1. A playable slice with Robotic Missions only: Planning Mode, an orbiter and a lander, Mission Mode with the solar system and Mars orbit views, and a thin simulation behind them.
2. The surface view, Ongoing Research and Research Grants.
3. Crewed Missions, Health, Supplies and bases.

Automated balance runs get added once the simulation has enough rules to balance.

## Saving

- The game saves automatically at the start of each Planning Mode.
- A few manual save slots are available, usable only in Planning Mode. Saving partway through Mission Mode isn't possible. Together with the fixed random seed, this stops reloading to undo a bad outcome.

## Science

- Science is the score. It is weighted heavily towards activity at Mars itself, for example 100 for an orbiter surveying landing sites and 1000 for returning samples to Earth.
- Science comes from two sources:
  - Milestones: one-off achievements, such as returning a sample.
  - Ongoing Research: a steady rate earned only while an Asset or Crew is actively doing the work, such as analysing fresh soil samples in a lab on Mars. The rate doesn't decline over time.
- Science already earned is never taken away.
- Some Science pays a Research Grant at the start of the next Turn. Only certain research qualifies, at a rate set for each kind, and early-game research pays little or nothing. Late in a Program, Research Grants are the main income and Public Support matters less. Like a rover mission, public excitement peaks early and fades while the Science carries on.

## Public Support and money

- Milestones award Public Support points.
- When Public Support reaches a Funding Threshold, it pays a fixed sum. For example, 100 points plus 200 for putting an orbiter at Mars crosses the 300-point threshold, which pays $1 billion.
- Each Funding Threshold pays only the first time it is reached. Falling below and climbing back pays nothing.
- There is no regular Appropriation. Running out of money through poor management is a way for the player to fail.
- There is no separate bankruptcy rule. A player with no money lets Turns pass without launching, and Public Support drains until the Program is cancelled, unless what they've built keeps it going. Cancellation is the only way to lose.
- Funding Thresholds are a fixed, limited list, mainly an early and mid-game boost.
- Public Support falls by a percentage each Turn (for example 15%), so spikes fade fast and then level off. The Program is cancelled if it drops below the Cancellation Level (for example 50). Ongoing Research adds a small, steady amount, enough for a productive Program to stay above the Cancellation Level but not enough to keep reaching new Funding Thresholds. _To be checked in playtesting._
- Costs are in millions of dollars, at roughly real-world scale. Starting figures, to be tuned: orbiter $0.5–1B, lander $1–2.5B, Crewed Mission $50B and up.

## Starting conditions

- The Program starts at the late-2028 Launch Window with about $2B and 100 Public Support, so the 300-point Funding Threshold is the first payout.
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
