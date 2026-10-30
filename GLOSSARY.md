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
_Avoid_: Expedition, flight

**Launch Vehicle**:
The rocket chosen from the catalogue to launch a Mission. It sets how much mass the Mission can carry.
_Avoid_: Rocket, booster

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

**Health**:
A single value for each Crew member. Radiation, time at Mars and failed Mission Events lower it, Protection slows the decline, and at zero the Crew member dies.
_Avoid_: Condition, hit points

**Supplies**:
The food, water and other consumables Crew need to stay alive. When they run out, Health falls quickly.
_Avoid_: Consumables, life support (as the general term)

## Assets

**Asset**:
A pre-designed piece of hardware chosen from a catalogue, such as an orbiter, lander, rover, drone, habitat or fuel plant. Assets remain in place and keep working after their Mission until their Service Life ends.
_Avoid_: Part, module, component, unit

**Service Life**:
How long an Asset keeps operating once in place. Longer Service Life costs more.
_Avoid_: Lifespan, durability

**Activity**:
The one task given to an Asset or Crew for a Turn, such as soil analysis, driving to a new site or nothing.
_Avoid_: Task, job, assignment

**Landing Site**:
A named location on Mars where a Mission can land, with its own landing risk, Science value and resources such as water ice. Sites become available only through a Survey.
_Avoid_: Location, zone, region

**Survey**:
Observing Mars from orbit to reveal Landing Sites and lower their landing risk.
_Avoid_: Scan, reconnaissance

## Modes

**Planning Mode**:
The first part of a Turn, in which the player chooses Missions, Assets, technology and Safety Margin and spends money. No game time passes in Planning Mode.
_Avoid_: Build mode, design mode

**Mission Mode**:
The graphical second part of a Turn, in which the Turn's Mission and every operating Asset and Crew play out until the next Launch Window.
_Avoid_: Flight mode, simulation mode, play mode

**Decision Point**:
A moment in Mission Mode when play pauses for the player to make a limited choice, such as aborting or using a Contingency.
_Avoid_: Prompt, intervention

## Risk

**Mission Event**:
A discrete, riskable step within a Mission, such as launch, Mars transfer burn, aerocapture, entry/descent/landing or rendezvous. Each one has a failure probability.
_Avoid_: Step, phase

**Safety Margin**:
Everything the player buys to reduce risk. It comes in three kinds (Reliability, Contingency and Protection) and costs money and sometimes mass.
_Avoid_: Safety budget, safety level

**Reliability**:
Safety Margin that lowers a Mission Event's failure probability, such as testing or redundancy.
_Avoid_: Quality

**Contingency**:
Safety Margin that changes the outcome when a Mission Event fails, such as an escape module or abort fuel.
_Avoid_: Backup, fallback

**Protection**:
Safety Margin that reduces harm to Crew that builds up over a Mission's Duration, such as radiation shielding.
_Avoid_: Shielding (as the general term)

**Hazard**:
A random environmental danger that happens during Mission Mode, separate from planned Mission Events, such as a dust storm or a solar particle event.
_Avoid_: Random event, disaster

## Balance elements

**Science**:
The Program's score. It comes from Milestones and Ongoing Research, and is weighted heavily towards activity at Mars itself. Earning Science also pays money, which is the main income late in a Program.
_Avoid_: Points, research

**Milestone**:
A one-off achievement, such as the first orbiter at Mars or returning a sample to Earth. It awards Science and Public Support.
_Avoid_: Achievement, goal, objective

**Ongoing Research**:
Science earned at a steady rate for as long as an Asset or Crew is actively doing it, such as analysing fresh soil samples in a lab on Mars. The rate doesn't decline over time.
_Avoid_: Passive science, income

**Public Support**:
Points of public and political backing. Milestones add them, setbacks such as losing Crew remove them, and they drain slowly over time. Reaching a Funding Threshold pays money; falling to zero cancels the Program.
_Avoid_: Popularity, approval, morale

**Funding Threshold**:
A Public Support level that pays a fixed sum the first time it is reached, for example $1 billion at 300 points. Reaching it again later pays nothing.
_Avoid_: Tier, level, bracket

**Duration**:
How long a Mission lasts. Longer Missions use more supplies and expose Crew to more radiation.
_Avoid_: Mission length, time budget

## Technology

**Technology Readiness**:
How mature a technology is, from flight-proven to not yet built. Less mature technology costs more, needs development time before it can fly and fails more often until it has flown successfully.

**Development**:
Paying up front, in Planning Mode, to bring an immature technology to the point where it can fly. It takes a set number of Turns.
_Avoid_: Research (that word is reserved for Science), R&D

**Flight-proven**:
Describes a technology that has been used successfully at least once. It is cheaper and more reliable from then on.
_Avoid_: Mature, qualified
_Avoid_: TRL (in player-facing text), tech level
