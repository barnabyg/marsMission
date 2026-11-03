# Game design decisions

The game rules settled so far, grouped by area. Most describe the finished game, so check Status below for what exists today. Current balance values, such as money, Public Support, Science and risk, live only in the data files in [public/data](../public/data), so any such figure here is an example, not the game's value. Vocabulary follows [GLOSSARY.md](../GLOSSARY.md); platform and fidelity decisions are in [docs/adr/](adr/). Items marked _open_ are still being decided.

## Status

Phases are defined in the [Build order](#build-order). Phases 1 to 6 are built:

- **Phase 1:** Turns running from one Launch Window to the next, with at most one Mission each; Assets that stay operating at Mars; Mission Events listed from what a Mission carries; Planning Mode with one Launch Vehicle and one orbiter; Mission Mode with the solar system view, speed controls and text screens; Science, Milestones, Funding Thresholds, the Public Support drain and Cancellation Level; retiring a Program and the Program summary; tooltips.
- **Phase 2:** Mission Event failure with Risk Bands; Reliability; the fixed random seed; automatic saves and manual save slots; the first sound effects.
- **Since the Phase 2 playtest:** Save, Load and Retire Program dialogs in Planning Mode; text sized for 150% display scaling; Pause in Mission Mode; the events column in place of Phase 1's text screens.

- **Phase 3:** a lander and entry/descent/landing; Landing Sites, each with a landing risk and a Science value earned by the first landing there; Missions carrying several Assets within a Launch Vehicle's mass limit, with a second, larger Launch Vehicle brought forward from Phase 6; partial Mission failure, where Assets already delivered are safe; automatic Surveys from orbit; a Service Life chosen for each Asset; Assets failing in service, with Reliability bought for each Asset; a second Funding Threshold; the Mars orbit view, with automatic view changes and smooth camera moves. Saves upgrade step by step from any earlier format.
- **Since the Phase 3 playtest:** End Turn in Mission Mode.

- **Phase 4:** Activities, with Survey, research and Nothing as the first ones; Ongoing Research, which also adds a little Public Support; Research Grants, which take over from Funding Thresholds as the main income of a Program that keeps Assets at Mars; a rover, choosing between Science and money; Science Milestones and more Funding Thresholds; the surface view, with generated terrain, landing and crash sequences it moves to by itself, and rovers that move according to their Activity; automated balance runs, and the numbers tuned with them, including longer Service Lives.

- **Phase 5:** Decision Points, with no time limit and End Turn stopping at each one; Contingency, a gamble bought in Planning Mode and used for a second roll when its Mission Event fails; Slow, Fast and Free-return Trajectories; dust storms and solar particle events, the first Hazards; go/no-go checks before a landing in a dust storm; the spacecraft view, which Mission Mode moves to for a solar particle event or a failed Mars transfer burn; the balance report on Decision Points, and the numbers tuned with it. With no Crew yet, a solar particle event harms hardware, costing Service Life or losing the Mission, and Protection waits for Phase 7; holding off a landing costs Service Life, as there are no Supplies to spend.

- **Phase 6:** Technology Readiness on every Asset and Launch Vehicle, and Flight-proven status, with the Pinpoint Lander, built but not yet flown, as the first technology that starts unproven; Development, with the Endurance Rover as the first technology that needs it; the Meridian Colossus, a Launch Vehicle that needs Development and carries the most mass, but only with Orbital refuelling, whose Tanker launch and Rendezvous are Mission Events, shown in Earth orbit in the spacecraft view, which Mission Mode moves to for the Rendezvous; the Courier Relay, a relay orbiter whose Benefit, the first between Assets, raises the Ongoing Research of everything on the surface; tooltips for every new term; the balance report on technology, with strategies that develop technology and ones that keep to what is Flight-proven, and the numbers tuned with it. The Meridian Colossus doesn't yet earn its place: a Mission can't carry two of the same Asset, so few Missions need more than the Meridian Heavy carries, and in the balance runs filling the Meridian Heavy does better than developing the Meridian Colossus. Phase 7 gives it a Mission that needs it.
- **Since the Phase 6 playtest:** a Mission that starts each Turn with no Asset chosen, with a tag on each Asset already operating at Mars.

- **Phase 7 so far:** Crewed Missions to Mars orbit, with a Crew size chosen in Planning Mode, too heavy for any Launch Vehicle but the Meridian Colossus; named Crew who arrive in Mars orbit and stay there, sharing one Activity and earning Ongoing Research; Health, which radiation on the way and at Mars, time at Mars and Contingency rescues lower, so that Crew at Mars die there in the end; the First Crew at Mars Milestone; a balance strategy that flies Crew; losing Crew to a failed Mission Event, including a failed launch, or to a solar particle event that loses the Mission, with a large drop in Public Support; a Free-return bringing Crew home alive. In Mission Mode the Crew's ship stands in for them, shown as an orbiter.

Any rule in this document beyond these is planned, so its absence from the code isn't a bug.

## Program and Turns

- A Program is open-ended. In practice it winds down when the player runs out of worthwhile things to build or do.
- A Program ends when the player retires it or when Public Support falls below the Cancellation Level and it is cancelled. Either way, a Program summary shows total Science and the Milestones achieved.
- A late-game goal is to build up enough that the Program carries on indefinitely, producing enough money and Public Support with little input from the player.
- At most one Mission is launched per Turn, as a single journey. This keeps Mission Mode buildable.
- A Mission ends when it has delivered its Assets and Crew, or has failed. After that they operate at Mars on their own, so Mission Mode shows the Turn's Mission plus everything already operating.
- If assembling or refuelling in Earth orbit needs several launches, those launches and Rendezvous are Mission Events within the one Mission.
- A Launch Vehicle that needs Orbital refuelling brings a Tanker launch and a Rendezvous as Mission Events of its own, each on its own day after launch. The Mission leaves Earth orbit with its Mars transfer burn on the day after the last of them, while every other Mission makes that burn the day after launch. Its Duration still counts from launch, so the days in Earth orbit are part of it, and a solar particle event can't hit it until it has left.
- The Tanker launch and the Rendezvous behave as every other Mission Event does: each has its own failure probability and a Risk Band in Planning Mode, Reliability lowers it, the Launch Vehicle's unproven multiplier raises it, and a failure loses everything on board and costs Public Support. Like launch, they have no Contingency yet. A Launch Vehicle that brings them is Flight-proven only once it gets past them and its Mars transfer burn.
- The Launch Vehicle is chosen from the catalogue and sets how much mass the Mission can carry.
- Each Mission picks one of 2–3 fixed Trajectories, such as Slow (least fuel, longest Duration), Fast (more fuel and mass, less radiation for Crew) or Free-return (swings back to Earth if the arrival burn fails, at the cost of flexibility). Until there is Crew, Fast pays through earlier arrival, which gives the Mission's Assets more research days in that Turn. A Turn's length doesn't change. Changing Trajectory doesn't re-roll a Mission Event's outcome.
- Free-return is offered only on a Mission that has Mars orbit insertion, because a lander alone has no arrival burn. If that burn fails, the Mission swings back to Earth instead of being lost: it costs no Public Support and refunds a share of the cost of the Assets on board, and everything not yet delivered comes back with it. The Assets aren't flown again, and nor are any Crew it brings home, alive. If the Mission has a Contingency for the burn, its Decision Point comes first, and the Free-return outcome replaces the ordinary loss when it's declined or its second roll fails, with its extra Public Support still applying in that second case. Free-return costs something when nothing goes wrong, so that it isn't always the right choice.
- Missions can go to Mars orbit or to a Landing Site. Phobos and Deimos are left out of the first version.
- In Planning Mode the player gives each Asset one Activity for the Turn. Crew in one place at Mars, such as Mars orbit or one Landing Site, share one Activity.
- Each Turn begins at a Launch Window (roughly every 26 months) and consists of Planning Mode followed by Mission Mode.
- No game time passes in Planning Mode. Mission Mode runs from one Launch Window to the next, showing every Mission in flight and every operating Asset together. Mission Events don't hold game time; Decision Points pause play.
- The player can end a Turn early from Mission Mode, on any Turn, which skips to the Turn summary. It only skips the viewing: the rest of the Turn still happens, with the same outcome. End Turn stops at the next Decision Point rather than skip it, and can be used again once it's answered.
- Missions can overlap Turns. For example, a Crewed Mission that stays on the surface for a long time lasts about 2.5 years, so the next Turn's Planning Mode happens while Crew are still at Mars.
- Doing everything in a single Mission ("one jump") is possible but very expensive and risky. Building up Assets over several Turns is the intended cheaper path.
- Robotic and Crewed Missions are both available. Crewed Missions cost much more and earn more Public Support.

## Assets

- Players choose pre-designed Assets from a catalogue. There is no assembly from parts.
- Assets stay at Mars and keep working into later Turns, within reason: each has a limited Service Life, and longer Service Life costs more.
- An Asset may fail before its Service Life ends, in any Turn after the one it arrives in. This is a probability that Reliability lowers, bought separately for each Asset. For now it costs no Public Support, which playtesting may change.
- No repairs or Service Life extensions in the first version.
- Planning Mode starts each Turn's Mission with no Asset chosen, so that one already at Mars never looks as if it has to be launched again. An Asset with one or more of itself operating at Mars is tagged with how many, and Operating at Mars comes first beside the Mission.
- Assets give each other a limited set of specific benefits, defined in the catalogue. For example, a relay orbiter raises the Ongoing Research rate of everything on the surface, a fuel plant makes a return journey possible and a habitat lets Crew stay longer.
- A Benefit is defined in the data files on the Asset that gives it: what it raises and by what percentage. The first is a relay orbiter's, which raises the Ongoing Research of every Asset on the surface: its Science and Public Support, and so its Research Grant. An orbiter's own research isn't raised.
- A Benefit applies on each day the Asset giving it operates at Mars, whatever its Activity, from the day it arrives until it fails or its Service Life ends. Benefits that raise the same thing don't add up: on each day the largest applies, so a second relay orbiter adds nothing.
- An Asset on the surface earns at the raised rate on the days that are raised and at the usual rate on the others, and its Science and Public Support are rounded up once for the Turn, as usual. Its Science and Public Support build up faster on raised days, so Science Milestones and Funding Thresholds can come sooner, and sheltering from a dust storm gives up the raised rate for the storm's days.
- Planning Mode tags each Asset that gives a Benefit, and the tag's tooltip describes it. Planning Mode also shows the raised rate for an Asset on the surface while an Asset giving the Benefit is operating with Service Life left as the Turn starts, or is on the Turn's Mission. That figure is for a whole Turn, so it doesn't allow for one arriving, failing or ending partway. The Turn summary says how much of each Asset's Ongoing Research a Benefit added, and the balance report how much Science Benefits earned.
- Nothing about Benefits is saved: which Assets are operating is saved already, and what each gives comes from the data files.
- A spacecraft that can make the round trip costs more than a one-way one.

## Landing Sites

- Mars has named Landing Sites. Each has a landing risk and a Science value, earned by the first successful landing there. Resources such as water ice are left out until a rule uses them.
- Apart from the two starting sites, Landing Sites become available only through a Survey from orbit. Surveying also lowers a site's landing risk.
- Surveying is an Activity. In each Turn an Asset operates at Mars with Survey as its Activity, every known site drops to its surveyed risk in one step, and the next site in the catalogue becomes known. A second surveying Asset doesn't speed this up, and with none there is no Survey.
- A newly chosen Asset starts on the first Activity it lists in the data files, so an orbiter surveys, and a lander or a rover does research, unless the player chooses otherwise. It starts on the day it is delivered, and an Asset that is lost never starts.
- A rover lands at a Landing Site just as a lander does, and stays around it. The named sites are thousands of kilometres apart, and earning first-landing Science by driving would undercut landers. Its Activities are a choice between Science and money: soil analysis earns less Science and pays a Research Grant, and a long traverse earns more Science and pays none.
- A rover and a lander can share a Mission. They go through one entry/descent/landing together, at one Landing Site, each with its own Activity, and a crash loses both. Whichever lands first earns First landing on Mars, and the first rover also has a Milestone of its own.
- An Asset keeps its Activity from Turn to Turn until the player changes it, so a large Program doesn't need re-setting every Turn.

## Risk and Safety Margin

- Each Mission is a sequence of Mission Events, and each Event has a failure probability.
- An Asset is delivered when its last Mission Event succeeds. When a Mission Event fails, Assets already delivered are safe and everything else is lost. A lander alone goes straight to entry/descent/landing, so carrying an orbiter as well is cheaper than two Missions but exposes the lander to orbit insertion.
- The game builds the list of Mission Events automatically from what the Mission carries. A lander or a rover adds entry/descent/landing, and Orbital refuelling adds a Rendezvous. The player then buys Safety Margin against that list.
- Safety Margin comes in three kinds:
  - Reliability (testing, redundancy) lowers an Event's failure probability.
  - Contingency (escape module, abort fuel) changes the outcome when an Event fails. Decision Points are often where a Contingency is used.
  - Protection (radiation shielding) reduces harm to Crew that builds up over the Mission's Duration.
- A Contingency is a gamble, because a guaranteed rescue would always be the obvious answer. If its Mission Event fails, the player chooses at a Decision Point. Using it is a second roll, shown as a Risk Band: success saves every Asset not yet delivered with a shorter Service Life, and the Crew on board with less Health, and failure loses them and costs extra Public Support. Declining takes the ordinary loss. A Mission Event that fails with no Contingency bought raises no Decision Point. A rescued landing is a hard landing: it plays as a landing after the Decision Point, and earns first-landing Science and Milestones as any landing does. Launch has no Contingency yet.
- A Turn is worked out from the seed, the plan and the answers so far, and stops at the first unanswered Decision Point. Answering works it out again with that answer added, and doesn't re-roll anything else. Decision Points aren't saved, so a reload during one returns to the start of the Turn.
- All Safety Margin is worth having but expensive.
- Failure probabilities are shown to the player as rough bands (for example "~5%"), not exact figures.
- The random seed is fixed when the Program starts, so the same plan gives the same outcome after a reload. A changed plan can avoid a failure already seen, for example by buying more Reliability or by not launching. _Open: whether to keep this gap is to be settled by playtest feedback._
- Hazards are random environmental dangers, separate from planned Mission Events, that can raise Decision Points. Dust storms and solar particle events are the first two. A dust storm cutting solar power is planned.
- A dust storm can blow up over any Landing Site in a Turn, for a stretch of days. Whether it does, when and for how long come from the seed, the Turn and that site alone, so no plan or answer moves it. It raises a Decision Point only if an Asset is operating at that site when it starts: sheltering keeps the Assets there safe but earns no Ongoing Research for the storm's days, and carrying on keeps them earning with a chance of each failing for good. It costs no Public Support, an orbiter isn't affected, and with nothing at stake it is only an entry in the events column.
- A solar particle event can hit a Mission on its way to Mars, so never one that has arrived, and never with no Mission in flight. Each day on the way carries the same chance, so a longer Trajectory is more exposed. With no Crew yet it threatens hardware: safe mode costs each Asset on board some Service Life, and carrying on costs nothing unless they're hit, which shortens Service Life much further or loses the Mission and costs Public Support as a failed Mission Event does. Losing the Mission loses any Crew aboard, as losing Crew does.
- A landing due while a dust storm is over its Landing Site gets a go/no-go check, a Decision Point. Go lands now at a raised risk. Hold off lands on the day the storm has passed, at the usual risk, which moves the landing, the delivery, the research days and any Milestones with it, all within the Turn. Until there are Crew and Supplies, the only cost of waiting is Service Life, lost by each Asset being landed for each day held. There is no check for any other risk, such as landing at a site that hasn't been surveyed, because waiting does nothing for it. A Contingency for the landing still applies if it fails, whichever answer was given.

## Mission Mode

- A Turn takes about 20 minutes at 1x speed, with controls to speed it up to 5x or 10x, or to pause it. Pausing only affects how a Turn is shown and lasts only for that Turn, because choosing a speed is what ends it and the next Turn starts at the speed last chosen.
- The graphics are a mix of pre-made animations (such as an asteroid strike on a base) and displays (such as orbital tracking of a journey).
- Pre-made animations are scripted 3D sequences that run live in the game, not pre-rendered video, so they show the Assets the player actually bought at the Landing Site they actually chose.
- The first animation goal is one success and one failure animation per kind of Mission Event, and one per Hazard. More will follow. Each Mission Event, Milestone and Funding Threshold is added to an events column beside the view when it happens, with its date, title and description, newest at the top, and stays until the Turn ends. Nothing needs dismissing and time keeps running, so the player pauses to read. A failure stands out in the failure colour and plays its sound. A successful launch or Tanker launch plays the launch sound, and a Rendezvous its own.
- Play pauses at each Decision Point with no time limit. What raises one is under [Risk and Safety Margin](#risk-and-safety-margin).
- Mission Mode has four views, with smooth camera transitions between them:
  - Solar system: Earth, Mars and the Mission's journey along its Trajectory.
  - Mars orbit: orbiting Assets, arrival, aerocapture.
  - Surface: a Landing Site, with landings, rovers and bases.
  - Spacecraft: a close-up of the Mission in transit, used when something happens on the way: a solar particle event or a failed Mars transfer burn. A Mission with Orbital refuelling is shown in Earth orbit until it leaves for Mars, with its Tanker climbing from Earth, docking to refuel and pulling away, or colliding with it.
- The view switches automatically for Mission Events and Hazards, and the player can switch views at any time.
- A landing or crash plays for a few seconds of real time, the same at every speed, and pausing holds it. It only displays what has already been worked out. After a crash, the view goes back to whichever Landing Site still has something to show, or else to Mars orbit.
- A Rendezvous, and the Tanker launch before it, play the same way. Once the Rendezvous has played, the view goes back to where it was before, or to the solar system if that was the spacecraft view and the Mission is lost.

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
7. **First Crew:** Crewed Missions, Crew and Health, Supplies and Protection, with a Crewed Mission too heavy for the Meridian Heavy, so that the Meridian Colossus earns its place.
8. **Coming Home:** return journeys, returning samples, a fuel plant, a habitat and a Mars lab.

## Saving

- The game saves automatically at the start of each Planning Mode.
- A few manual save slots are available, usable only in Planning Mode. Saving partway through Mission Mode isn't possible, so a reload always returns to the start of a Turn. What that can and can't undo is under [Risk and Safety Margin](#risk-and-safety-margin).

## Science

- Science is the score. It is weighted heavily towards activity at Mars itself, for example 100 for an orbiter surveying landing sites and 1000 for returning samples to Earth.
- Science comes from two sources:
  - Milestones: one-off achievements, such as returning a sample, or reaching a total of Science.
  - Ongoing Research: a steady rate earned only while an Asset or Crew is actively doing the work, such as analysing fresh soil samples in a lab on Mars. The rate doesn't decline over time.
- An Asset earns its share of a whole Turn's Ongoing Research for the days it does the Activity, from the day it arrives until it fails or its Service Life ends. Its Science and Public Support are each rounded up for that Asset and Turn, so a short stint still earns something. An orbiter chooses between this and a Survey.
- Science already earned is never taken away.
- Some Science pays a Research Grant at the start of the next Turn. Only Ongoing Research qualifies, at a rate set for each kind of research, and early-game research pays little or nothing. Science from Milestones and first landings pays none. No game time passes between the end of a Turn and the next Planning Mode, so the money is added when the Turn resolves, including for a Turn that ends in cancellation. Each Asset's grant for a Turn rounds to whole millions, so one under $0.5M pays nothing. Late in a Program, Research Grants are the main income and Public Support matters less. Like a rover mission, public excitement peaks early and fades while the Science carries on.

## Public Support and money

- Milestones award Public Support points.
- Science Milestones reward a productive Program for its results. Each is awarded once, on the first day the Program's total Science reaches its level, and if a Program is already past it, on the first day of the Turn. Science comes in on the day of an arrival, a first landing or an award, and builds up evenly over each Asset's days of Ongoing Research, reaching exactly what that Asset earns for the Turn. Anything reached only as the Turn ends counts on its last day. The Science from one of these awards counts towards the next from the day it's awarded. A Turn that ends in cancellation still awards them, and their Public Support can prevent it, as with any Milestone.
- When Public Support reaches a Funding Threshold, it pays a fixed sum. For example, 100 points plus 200 for putting an orbiter at Mars would cross a 250-point threshold, which might pay $1 billion.
- Each Funding Threshold pays only the first time it is reached. Falling below and climbing back pays nothing.
- A Funding Threshold is reached if Public Support is at or above it once the Turn's gains and losses are all in, before the drain. Its entry in the events column is on the day Public Support got there for the last time in the Turn, so never before the award that took it there. A Program saved already above one pays it on the first day of its next Turn, unless a failed Mission takes it back below for good.
- There is no regular Appropriation. Running out of money through poor management is a way for the player to fail.
- There is no separate bankruptcy rule. A player with no money lets Turns pass without launching, and Public Support drains until the Program is cancelled, unless what they've built keeps it going. Cancellation is the only way to lose.
- Funding Thresholds are a fixed, limited list, mainly an early and mid-game boost.
- Public Support falls by a percentage each Turn (for example 15%), so spikes fade fast and then level off. The Program is cancelled if it drops below the Cancellation Level (for example 50). Ongoing Research adds a small, steady amount, enough for a productive Program to stay above the Cancellation Level but not enough to keep reaching new Funding Thresholds. _To be checked in playtesting._
- Costs are in millions of dollars, at roughly real-world scale. For example: orbiter $0.5–1B, lander $1–2.5B, Crewed Mission $50B and up.

## Starting conditions

- The Program starts at the late-2028 Launch Window. Its starting money and Public Support, in [public/data/program.json](../public/data/program.json), are set so that a first orbiter reaches the first Funding Threshold, and so that the player can afford an orbiter or a lander and a retry if it fails, with a little left for Reliability. A first orbiter followed by a first landing, in either order, reaches the second Funding Threshold. So does a first rover by itself, with its own Milestone, but it costs too much to leave a retry, which makes one on the first Turn a gamble. Later Funding Thresholds come from the Science Milestones in [public/data/milestones.json](../public/data/milestones.json).
- Two well-known Landing Sites (for example Jezero and Gale) are available from the start, at high landing risk because they haven't been surveyed. The first Turn is a choice between surveying first and landing straight away.
- No difficulty levels in the first version.

## Crew

- Crew are named, with no individual traits apart from Health.
- The player chooses the Crew size for each Mission, trading more mass and Supplies against more research.
- Losing Crew causes a large drop in Public Support. The only Science cost is that the Ongoing Research they were doing stops.
- Crew don't have to come home. Staying at Mars harms them through radiation and other effects.
- Bringing Crew home safely earns a large amount of Public Support. Every safe return earns it, and the first return is also a Milestone worth more.
- A later Mission can fetch Crew already at Mars if it carries a return vehicle.
- Each Crew member has a single Health value. Radiation, time at Mars and Contingency rescues lower it, Protection slows the decline, and at zero they die.
- Health is a whole number, from the most Crew launch with down to zero. How fast it falls, and what a rescue costs, are in [public/data/crew.json](../public/data/crew.json). Radiation takes some for each day on the way to Mars, and on the way home after a Free-return, so a Slow Trajectory costs more than a Fast one. At Mars, radiation and time at Mars each take some for every day there, carrying on from Turn to Turn, so Crew who reach Mars die there in the end. A Contingency that saves the Mission costs each Crew member on board a fixed amount at once, where it costs an Asset Service Life. Radiation is a cause of its own, so that Protection can slow just that.
- Each cause takes a whole point only once a whole point's worth has built up over the days, so the same days always cost the same Health. A Crew member dies on the first day their Health reaches zero, which counts as losing Crew, with its drop in Public Support, and stops their Ongoing Research from that day. That can happen on the way, if a long Trajectory and a rescue take them to zero: they don't arrive, or don't come home.
- Planning Mode shows each Crew member's Health, and the Health radiation on the way would leave a Crewed Mission's Crew as they arrive. The Turn summary says how much each Crew member lost and to what, whether they are still at Mars, died or came home.
- Crew need Supplies. When Supplies run out, Health falls quickly.
- A Crewed Mission, with its Crew, Supplies and Protection, weighs more than the Meridian Heavy can carry, so it needs the Meridian Colossus, or a Launch Vehicle at least as large. Developing the Meridian Colossus is then the step towards Crew, rather than a bigger launcher with nothing to fill.
- A Crewed Mission is a Mission with Crew chosen for it, rather than an Asset: the plan names a Crew size, and later its Supplies and Protection. The Crew sizes on offer, what each costs and weighs, the ship that carries them, its Mission Events, the Crew's Health and Activities and their names are in [public/data/crew.json](../public/data/crew.json). The Crew size's cost and mass add to the Mission's, which can carry Assets as well, within its Launch Vehicle's mass. Even the smallest Crew is too heavy for the Meridian Heavy.
- Crew aren't a technology, so they have no Technology Readiness, Service Life or Reliability in service: Health takes the place of Service Life. The Mission Events their ship brings, such as Mars orbit insertion, have Reliability and Contingency as any Mission Event does, and a Free-return is offered for that burn.
- Crew are named from the data files' list in order, and a name is never given twice in a Program, so a Crewed Mission needs enough names left for its Crew size.
- Crew arrive in Mars orbit when the last of their ship's Mission Events succeeds, with the Health their flight left them, and stay there, operating on their own in later Turns. If a Mission Event fails first, they don't arrive.
- The Crew in one place share one Activity, kept from Turn to Turn until the player changes it, as an Asset's is. Crew arriving where Crew already operate take up their Activity, and otherwise the one the Crewed Mission chose. Each Crew member earns the Activity's Ongoing Research rate, so a larger Crew earns more, with its Public Support and any Research Grant, from the day they arrive. Benefits don't raise research in orbit.
- The first Crew to reach Mars earns a Milestone of its own. Even the smallest Crew earn more Public Support from Ongoing Research than any one Asset does.
- A Mission Event that fails for good with Crew still aboard loses them, as it loses the Assets not yet delivered. Launch has no Contingency yet, so a failed launch kills the Crew. A solar particle event that loses the Mission loses its Crew too.
- Losing Crew costs Public Support for each Crew member lost, set in [public/data/crew.json](../public/data/crew.json), on the day they're lost, on top of what the failure itself costs. It never takes Public Support below zero, so it can take all that's left. A Decision Point that could lose Crew says what losing them would cost. The events column and the Turn summary name each Crew member lost, as failures.
- Lost Crew earn no Ongoing Research from the day they're lost, and Crew already at Mars carry on. Their names are never given again. Whatever loses Crew, it works the same way, and the Program records why: a failed Mission Event, a solar particle event, Health running out, and later Supplies running out.
- If the arrival burn fails on a Free-return, the Crew come home alive with the Mission, with the Health they have left. Coming home costs no Public Support for them and earns none: the award for each safe return, and the Milestone for the first, wait for Phase 8. The events column and the Turn summary name them. Crew who are home aren't flown again, and their names aren't given again.
- The Program saves every Crew member who has flown, with their name, Health and where they are: at Mars, with their arrival date, lost, with the day and why, or home, with the day they got back. It also saves the Activity of the Crew in each place. A save from before Crew upgrades with none, and one from before Crew could be lost keeps its Crew at Mars, though the names of any lost on the way weren't kept and can be given again.

## Technology

- Every technology is visible from the start, labelled with its Technology Readiness. The best technology takes development time and money before it can fly, and is less reliable until it has flown successfully.
- Development is paid for up front in Planning Mode and takes a set number of Turns. After its first successful use, a technology is Flight-proven: cheaper and more reliable.
- Each Asset and Launch Vehicle is a technology. Its Technology Readiness in the data files is where it starts: flight-proven, or built but not yet flown. Every one from Phases 1 to 5 starts Flight-proven. Planning Mode tags each one Flight-proven, Unproven or Needs Development, and shows what it costs now.
- A technology that isn't Flight-proven has its own unproven cost, paid in place of its usual cost, and an unproven failure multiplier. The multiplier raises the failure probability of each Mission Event it brings, and of its failing in service, with any Reliability bought applying on top. A Mission Event that several technologies on the Mission bring is raised by the most unproven of them, and no failure probability goes above 100%. A Free-return refunds its share of what was actually paid for the Assets on board, so that includes the unproven cost of one that wasn't yet Flight-proven.
- An Asset that flew unproven keeps its raised chance of failing in service for the rest of its Service Life, even once its technology is Flight-proven, because it is the one that was built before anything had flown. Those built afterwards have the usual chance.
- Successful use means being delivered, for an Asset, and getting past its own Mission Events, for a Launch Vehicle, even if the Mission fails later. A Contingency that saves it counts. A failure before that, including a Free-return, leaves it unproven. It becomes Flight-proven on that day, as the events column and the Turn summary say, and its lower cost and risk apply from the next Turn on.
- A lander can have its own landing risk multiplier, such as one that lands more precisely. A landing is as risky as the riskiest Asset in it, so the Landing Site's risk is multiplied by the highest of them.
- The Program saves which technologies it has made Flight-proven, and whether each operating Asset flew unproven. A save from before Technology Readiness upgrades with nothing added to either, so everything it holds stays Flight-proven, as it always was.
- A technology can also start not built, which needs Development before it can be chosen for a Mission. The data files give its Development cost and how many Turns it takes, as well as its unproven cost and failure multiplier, which apply once it is built. Planning Mode lists each one from the start in its Development panel, with its cost and Turns, and shows it among the Assets or Launch Vehicles, where it can't be chosen until it is built.
- The player starts Development in Planning Mode, as part of the Turn's plan, with or without a Mission. Its whole cost is paid in that Turn, alongside the Mission's cost, so a plan that can't afford both is rejected. Any number of Developments can be in progress at once, limited only by money. Once started, it can't be cancelled or refunded, and it can't be started again.
- Development started in a Turn's Planning Mode finishes at the start of the Planning Mode its set number of Turns later: Development of two Turns started on Turn 1 finishes as Turn 3 starts. The technology is then built, so it can be chosen for a Mission, and is unproven until its first successful use. Until then, Planning Mode shows how many Turns it has left, and the Turn summary says when Development started and when it finished. Starting it is the only choice: it needs nothing else from the player.
- The Program saves each Development started, with the Turn it finishes on, so a change to the data files doesn't move one already in progress. A save from before Development upgrades with none started.
