# Mars Mission

A planning and simulation game in which the player runs a Mars exploration Program on a budget. Turn by turn, the player balances safety, duration, science and public support, starting with robotic precursors and working towards crewed Missions.

## Program structure

**Program**:
One complete game: an open-ended sequence of Turns in which the player launches Missions and builds up Assets at Mars. It ends when the player retires it or when it is cancelled.
_Avoid_: Campaign, run, playthrough

**Turn**:
The period from one Launch Window to the next. It is made up of Planning Mode followed by Mission Mode.
_Avoid_: Round, cycle

**Launch Window**:
The recurring opportunity, roughly every 26 months, when an Earth–Mars transfer is practical. Each Turn begins at one.
_Avoid_: Launch opportunity

**Mission**:
The single journey launched in a Turn's Launch Window, carrying one or more Assets and possibly Crew. There is at most one Mission per Turn. It ends when it has delivered what it carries, or has failed.
_Avoid_: Expedition, flight (as a name for a Mission; "in flight" for one on its way is fine)

**Launch Vehicle**:
The vehicle chosen from the catalogue to lift a Mission off Earth. It sets how much mass the Mission can carry.
_Avoid_: Rocket, booster

**Orbital refuelling**:
Filling a Mission's tanks in Earth orbit from a Tanker, so that a larger Launch Vehicle can send much more mass to Mars. It adds two Mission Events between launch and the Mars transfer burn: the Tanker's launch and the Rendezvous.
_Avoid_: In-orbit refuelling, propellant transfer, refueling

**Tanker**:
A second launch for a Mission that needs Orbital refuelling, carrying only propellant up to it in Earth orbit. Its launch is a Mission Event of its own.
_Avoid_: Fuel ship, depot

**Rendezvous**:
The Mission Event in which a Mission meets its Tanker in Earth orbit, docks and takes on propellant for the journey to Mars.
_Avoid_: Docking (as the name of the Mission Event)

**Trajectory**:
The way a Mission travels to Mars, chosen from a few fixed options such as Slow, Fast or Free-return. It trades fuel and mass against Duration and safety.
_Avoid_: Route, flight path, transfer

**Robotic Mission**:
A Mission with no crew aboard. It is cheaper than a Crewed Mission and risks only hardware and money.
_Avoid_: Unmanned mission, probe mission

**Crewed Mission**:
A Mission carrying Crew. It costs much more than a Robotic Mission and earns more Public Support, and failure can cost lives. Crew need not come home, but bringing them home safely earns a large amount of Public Support.
_Avoid_: Manned mission, human mission

**Precursor**:
A Robotic Mission whose main value is lowering the risk or cost of later Missions, for example by surveying landing sites.

**Crew**:
The named astronauts on a Crewed Mission. Apart from their names and Health, they have no individual traits.
_Avoid_: Astronauts (as a game term), personnel

**Crew size**:
How many Crew fly on a Crewed Mission, chosen in Planning Mode. A larger Crew earns more Ongoing Research, but weighs and costs more.
_Avoid_: Crew count, team size

**Health**:
A single value for each Crew member, out of the most they launch with. Radiation on the way and at Mars, time at Mars, Contingency rescues and carrying on through a dust storm lower it, Protection slows the decline, and at zero the Crew member dies.
_Avoid_: Condition, hit points

**Supplies**:
The food, water and everything else Crew use up to stay alive. When they run out, Health falls quickly.
_Avoid_: Consumables, life support (as the general term)

## Assets

**Asset**:
A pre-designed piece of hardware chosen from a catalogue, such as an orbiter, lander, rover, drone, habitat or fuel plant. Assets remain in place and keep working after their Mission until their Service Life ends or they fail.
_Avoid_: Part, module, component, unit

**Service Life**:
How long an Asset keeps operating once in place. Longer Service Life costs more.
_Avoid_: Lifespan, durability

**Benefit**:
What one Asset does for others on each day it operates at Mars, whatever its Activity, such as a relay orbiter raising the Ongoing Research of every Asset and Crew on the surface. A second Asset giving the same Benefit adds nothing.
_Avoid_: Bonus, buff, synergy

**Activity**:
What an Asset, or all the Crew in one place at Mars, is given to do for a Turn, such as soil analysis, a Survey or nothing. An Asset or Crew keep their Activity into later Turns until the player changes it.
_Avoid_: Task, job, assignment

**Landing Site**:
A named place on Mars where a Mission can land, with its own landing risk and Science value. Apart from a couple of well-known sites, they become available only through a Survey.
_Avoid_: Location, zone, region

**Survey**:
Observing Mars from orbit to reveal Landing Sites and lower their landing risk. It is an Activity, and one surveying Asset is enough.
_Avoid_: Scan, reconnaissance

**Orbital research**:
An Activity for an orbiter: Ongoing Research into the atmosphere and climate of Mars, in place of a Survey. It pays no Research Grant.

**Surface research**:
An Activity for a lander: Ongoing Research into the rocks and weather around its Landing Site. It pays a small Research Grant.

**Soil analysis**:
An Activity for a rover: Ongoing Research that stays near the Landing Site and analyses soil samples. It earns less Science than a Long traverse and pays a Research Grant.

**Long traverse**:
An Activity for a rover: Ongoing Research that drives long distances around the Landing Site. It earns more Science than Soil analysis and pays no Research Grant.

**Crew research**:
An Activity for Crew in Mars orbit: Ongoing Research from orbit, such as studying Mars, driving robots on the surface from above and running experiments aboard. Each Crew member earns it, and it pays a Research Grant.

**Field research**:
An Activity for Crew at a Landing Site: Ongoing Research on the surface, exploring around the site, collecting samples and studying them in their lander. Each Crew member earns it, a Benefit that raises research on the surface raises it too, and it pays a Research Grant.

## Modes

**Planning Mode**:
The first part of a Turn, in which the player chooses Missions, Assets, Activities, technology and Safety Margin and spends money. No game time passes in Planning Mode.
_Avoid_: Build mode, design mode

**Mission Mode**:
The graphical second part of a Turn, in which the Turn's Mission and every operating Asset and Crew play out until the next Launch Window.
_Avoid_: Flight mode, simulation mode, play mode

**Save Slot**:
One of three places where the player can keep a Program by hand, usable only in Planning Mode. It is separate from the automatic save made at the start of each Planning Mode.
_Avoid_: Save file, save game

**Decision Point**:
A moment in Mission Mode when play pauses for the player to make a limited choice, such as aborting or using a Contingency.
_Avoid_: Prompt, intervention

## Risk

**Go/no-go check**:
A Decision Point before a landing due while a dust storm is over its Landing Site: go ahead at a raised risk, or hold off until the storm has passed, at a cost in Service Life for each Asset being landed.
_Avoid_: Abort check, landing poll

**Mission Event**:
A discrete, riskable event within a Mission, such as launch, Mars transfer burn, Mars orbit insertion, entry/descent/landing or rendezvous. Each one has a failure probability.
_Avoid_: Step, phase

**Safety Margin**:
Everything the player buys to reduce risk. It comes in three kinds (Reliability, Contingency and Protection) and costs money and sometimes mass.
_Avoid_: Safety budget, safety level

**Risk Band**:
A rough failure figure shown for a Mission Event or an Asset in Planning Mode, such as "~5%", in place of its exact failure probability.
_Avoid_: Risk level, risk rating

**Reliability**:
Safety Margin that lowers the chance of a Mission Event or an Asset failing, such as testing or redundancy.
_Avoid_: Quality

**Contingency**:
Safety Margin that changes the outcome when a Mission Event fails, such as an escape module or abort fuel.
_Avoid_: Backup, fallback

**Protection**:
Safety Margin that reduces harm to Crew that builds up over a Mission's Duration, such as radiation shielding.
_Avoid_: Shielding (as the general term)

**Hazard**:
A random environmental danger that happens during Mission Mode, separate from planned Mission Events, such as a dust storm, a solar particle event or an asteroid strike on a base.
_Avoid_: Random event, disaster

**Dust storm**:
A Hazard: a storm over one Landing Site for a stretch of days. If an Asset or Crew are operating there when it starts, the player chooses between sheltering, which earns no Ongoing Research for those days, and carrying on, with a chance of each Asset failing and of each Crew member losing Health.
_Avoid_: Sandstorm, weather

**Solar particle event**:
A Hazard: a burst of radiation from the Sun that hits a Mission on its way to Mars, more likely the longer its Duration. The player chooses between safe mode, which costs each Asset on board some Service Life, and carrying on, with a chance of damage that costs much more or loses the Mission.
_Avoid_: Solar flare, radiation storm

## Balance elements

**Science**:
The Program's score. It comes from Milestones and Ongoing Research, and is weighted heavily towards activity at Mars itself.
_Avoid_: Points, research

**Milestone**:
A one-off reward for a feat, such as the first orbiter at Mars, reaching a total of Science, or returning a sample to Earth. It awards Science and Public Support.
_Avoid_: Achievement, goal, objective

**Ongoing Research**:
Science earned at a steady rate for as long as an Asset or Crew is actively doing it, such as analysing fresh soil samples in a lab on Mars. The rate doesn't decline over time. It also adds a small, steady amount of Public Support.
_Avoid_: Passive science, income

**Research Grant**:
Money paid at the start of a Turn for certain Ongoing Research done in the previous Turn, at a rate set for each kind of research. Early-game research pays little or nothing, and Science from Milestones and first landings pays none. It is the main income late in a Program.
_Avoid_: Science income, science payment

**Public Support**:
Points of public and political backing. Milestones and Ongoing Research add them, setbacks such as losing Crew remove them, and a percentage drains away each Turn as excitement fades. Reaching a Funding Threshold pays money; falling below the Cancellation Level cancels the Program.
_Avoid_: Popularity, approval, morale

**Funding Threshold**:
One of a fixed list of Public Support figures, each paying a fixed sum the first time it is reached. Reaching it again later pays nothing.
_Avoid_: Tier, level, bracket

**Cancellation Level**:
The Public Support level below which the Program is cancelled.
_Avoid_: Game over threshold, failure level

**Duration**:
How long a Mission lasts. Longer Missions use more supplies and expose Crew to more radiation.
_Avoid_: Mission length, time budget

## Technology

**Technology Readiness**:
How mature a technology is: Flight-proven, built but unproven, or not yet built, when it needs Development before it can fly. Until it is Flight-proven, it costs more and fails more often.
_Avoid_: TRL (in player-facing text), tech level

**Development**:
Paying up front, in Planning Mode, to bring an immature technology to the point where it can fly. It takes a set number of Turns.
_Avoid_: Research (that word is reserved for Science), R&D

**Flight-proven**:
Describes a technology that has been used successfully at least once. It is cheaper and more reliable from then on.
_Avoid_: Mature, qualified
