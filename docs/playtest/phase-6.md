# Phase 6 playtest: Better Technology

You can now gamble on technology that isn't proven yet, to unlock bigger Missions. Every Asset and Launch Vehicle shows its Technology Readiness. The Pinpoint Lander is built but unproven: until its first successful flight it costs more and fails more often, and after that it lands more safely than the Prospector Lander. The Endurance Rover and the Meridian Colossus aren't built yet, so they need Development first, paid up front and taking two Turns. The Meridian Colossus carries the most, but only with Orbital refuelling, which adds a Tanker launch and a Rendezvous to its Mission. The Courier Relay is a relay orbiter whose Benefit raises the Ongoing Research of everything on the surface. This takes about 25 minutes at 10x speed.

## Run it

You need [Node.js](https://nodejs.org/) 24 or later. In PowerShell, from the repository root (the folder containing this repository's `README.md`), run:

```powershell
.\run.bat
```

The first run installs what it needs. The game then opens in your browser. Press Ctrl+C in the terminal to stop it. Play at 3840×2160 if you can.

## Known seeds

Outcomes normally vary from one Program to the next. To see a particular one, open the game at the address below. If the terminal shows a port other than 4173, use that one instead. If the game offers **Continue this Program**, choose **Start a new Program**, which is what uses the seed.

| Address                                                 | What happens, with no Reliability, the shortest Service Life and the Slow Trajectory                                                                                        |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Unproven, and it works](http://localhost:4173/?seed=3) | The Pinpoint Lander's first flight lands at Jezero Crater on Turn 1, and it becomes Flight-proven. A Courier Relay sent on Turn 2 raises its research                       |
| [Unproven, and it fails](http://localhost:4173/?seed=1) | The Pinpoint Lander's first flight crashes at Jezero Crater on Turn 1                                                                                                       |
| [Failed rendezvous](http://localhost:4173/?seed=138)    | A rover lands at Jezero Crater on Turn 1, the Meridian Colossus is developed on Turns 2 and 3, and its first Mission, on Turn 4, collides with its Tanker at the Rendezvous |

Without `?seed=` in the address, each new Program gets its own seed, as in normal play. None of these seeds stops at a Decision Point on the Turns below.

## Scenario

1. **An unproven first flight.** Open [Unproven, and it works](http://localhost:4173/?seed=3). In Planning Mode, the Pinpoint Lander is tagged Unproven and costs $1.1B, against $800M for the Flight-proven Prospector Lander. Nothing starts ticked, and Launch Mission waits until something is. Tick the Pinpoint Lander and leave Jezero Crater as the Landing Site. The Mission costs $1.4B, and its Entry/descent/landing shows Over 30%, as the Prospector Lander's would: the Pinpoint Lander halves the landing risk, but raises it again until it is Flight-proven. Choose Launch Mission, then 10x. It lands, and the events column says the Pinpoint Lander is Flight-proven. The Turn summary shows money $2.3B to $1.937B and Public Support 100 to 303, and says it is now Flight-proven.
2. **Flight-proven, and a relay orbiter.** On Turn 2 the Pinpoint Lander is tagged Flight-proven and costs $900M, and a landing at Gale Crater with it shows ~20%, where the Prospector Lander's shows Over 30%. Don't launch it. Instead, tick only the Courier Relay, whose Benefit tag says what it raises. Launch it, for $1.2B. The Turn summary shows money $1.937B to $2.31B and Public Support 303 to 439, and says the Pinpoint Lander's Surface research earned 145 Science over 735 days, raised on 525 of them by the Benefit from Courier Relay, which added 50 Science. Its Service Life ends during this Turn.
3. **An unproven first flight that fails.** Open [Unproven, and it fails](http://localhost:4173/?seed=1) and choose **Start a new Program**. Launch the Pinpoint Lander to Jezero Crater as in step 1. It crashes. The Turn summary shows money $2.3B to $900M and Public Support 100 to 68. On Turn 2 nothing can be launched, because the cheapest Mission, an orbiter, costs $1B. Choose End Turn without launching twice, and the Program is cancelled on Turn 3. The Flight-proven Prospector Lander would have left enough money for a retry.
4. **Development.** Open [Failed rendezvous](http://localhost:4173/?seed=138) and choose **Start a new Program**. Tick the Trailblazer Rover, leave Jezero Crater and launch it, for $1.4B. It lands, and the Turn summary shows money $2.3B to $3.98B and Public Support 100 to 388. On Turn 2 the Development panel offers the Meridian Colossus and the Endurance Rover, each for $1.2B over 2 Turns. Start Development of the Meridian Colossus, choose End Turn without launching, then End Turn. The Turn summary says its Development started and shows money $3.98B to $3.54B, after the rover's Research Grant. On Turn 3 the panel says In Development: 1 Turn left. End the Turn without launching again, and the Turn summary says the Development finished.
5. **A failed rendezvous.** On Turn 4 the Meridian Colossus is tagged Unproven and costs $1.1B. Choose it as the Launch Vehicle and tick the Pathfinder Orbiter. The Mission costs $1.8B, and its Mission Events are Launch, Tanker launch, Rendezvous, Mars transfer burn and Mars orbit insertion, with the Rendezvous at ~10% while the Meridian Colossus is unproven. Hover over Tanker and Rendezvous for what they mean. Launch, and stay at 1x: on day 2 the view moves to the spacecraft in Earth orbit, where the Mission and its Tanker collide as they dock. The Turn summary shows money $3.54B to $1.74B and Public Support 286 to 226, and the Meridian Colossus is still unproven.

## Judge by eye and ear

The automated tests can't check these, so please look and listen on your own PC:

- The Technology Readiness and Benefit tags are easy to find in Planning Mode, and their tooltips say enough to choose.
- From Turn 2, it's clear that an Asset in Operating at Mars keeps working without being launched again, and that the New Mission panel is only for what to launch next.
- The Tanker launch, the Rendezvous and the collision look and sound like what they are, and the spacecraft view holds long enough to see them.
- The Development panel makes it clear what is in Development, for how long, and what it has cost.

## Feedback wanted

- **Is immature technology a tempting gamble, or an obvious yes or no?** In the balance runs, a Pinpoint Lander flown after a Survey earns a little more Science for less money, and its first flight fails in about one Program in six. Flown first at an unsurveyed site, it leaves no money for a retry and does worse than the Prospector Lander. Did you fly it unproven, and would you again?
- **Does Development compete properly with launching now?** Developing the Endurance Rover once a Program has the money for several rovers earns a little more Science and money, and starting it as soon as it can be afforded spends the money for a retry and more Programs are cancelled. When did you start a Development, and did you regret it?
- Is the Meridian Colossus worth developing? In the balance runs it pays in a Program that keeps many Assets, compared with sending one Asset per Mission, but filling the Flight-proven Meridian Heavy did better still. Did its extra capacity ever matter to you?
- When is the Courier Relay worth sending? It pays beside two or more Assets on the surface, and not as a Program's first orbiter.
