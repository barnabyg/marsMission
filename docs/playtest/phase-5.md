# Phase 5 playtest: Tough Choices

Things now go wrong in ways you can do something about. Play stops at a Decision Point whenever there's a choice to make: a Contingency you bought, a dust storm over your Assets, a solar particle event on the way to Mars, or a go/no-go check before landing in a storm. Each Mission also chooses a Trajectory, and the spacecraft view follows it on the way. This takes about 20 minutes at 10x speed.

## Run it

You need [Node.js](https://nodejs.org/) 24 or later. In PowerShell, from the repository root (the folder containing this repository's `README.md`), run:

```powershell
.\run.bat
```

The first run installs what it needs. The game then opens in your browser. Press Ctrl+C in the terminal to stop it. Play at 3840×2160 if you can.

## Known seeds

Outcomes normally vary from one Program to the next. To see a particular one, open the game at the address below. If the terminal shows a port other than 4173, use that one instead. If the game offers **Continue this Program**, choose **Start a new Program**, which is what uses the seed.

| Address                                           | What happens, with no Reliability and the shortest Service Life                                                                                                 |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Three Hazards](http://localhost:4173/?seed=1236) | The orbiter meets a solar particle event on Turn 1, a lander sent to Jezero Crater on Turn 2 gets a go/no-go check, and a dust storm blows up over it on Turn 3 |
| [Contingency](http://localhost:4173/?seed=13)     | The orbiter's Mars orbit insertion fails on Turn 1. With Reserve fuel bought, the Decision Point offers a second try, which works                               |
| [Lost on the way](http://localhost:4173/?seed=2)  | The orbiter's Mars transfer burn fails on Turn 1, the day after launch, and the spacecraft view shows it                                                        |

Without `?seed=` in the address, each new Program gets its own seed, as in normal play.

## Scenario

1. **A solar particle event.** Open [Three Hazards](http://localhost:4173/?seed=1236). Leave Planning Mode as it starts, with the Pathfinder Orbiter on the Slow Trajectory, and choose Launch Mission, then 10x. On the way to Mars, play stops at a Decision Point: Solar particle event, and the view moves to the spacecraft by itself. Safe mode costs the orbiter 15% of its Service Life. Carry on costs nothing unless the radiation hits, with a Risk Band of ~20%. Choose Safe mode. The Turn summary shows money $2.3B to $2.3B and Public Support 100 to 255, and says safe mode protected the orbiter.
2. **The spacecraft view.** While the orbiter is on its way, choose the Spacecraft button yourself on any Turn: it shows what the Mission carries. Once the Mission arrives, the view moves on, and the button is disabled with a note saying why.
3. **A go/no-go check.** On Turn 2 the orbiter has 535 days of Service Life left, 15% less than it would have had. Untick the orbiter, tick the Prospector Lander, leave Jezero Crater as the Landing Site, which a Survey has made safer, and launch it. When the lander reaches Mars, play stops at a Go/no-go check at Jezero Crater: a dust storm is over it with 114 days to go, and the view moves to the surface, where the storm is blowing. Go lands now at a Risk Band of ~20%. Hold off lands in 114 days at ~10%, and costs the lander 171 days of Service Life. Choose Hold off. The lander lands after the storm. The Turn summary shows money $2.3B to $2.729B and Public Support 255 to 434, says the landing was held off for 114 days, and the lander earned Science over 451 days of Surface research. Going ahead on this seed would have landed safely and earned over 565 days, but you couldn't know that.
4. **A dust storm.** On Turn 3, choose End Turn without launching, then 10x. A dust storm blows up over Jezero Crater for 211 days, and play stops with the lander at stake. Shelter keeps it safe and gives up 27 Science, 2 Public Support and $14M of Research Grants. Carry on keeps it working, with a Risk Band of ~10% of losing it. Choose Shelter. The Turn summary shows money $2.729B to $2.759B and says the lander sheltered for 211 days. Carrying on would have come through on this seed, for $2.773B.
5. **A Contingency.** Open [Contingency](http://localhost:4173/?seed=13) and choose **Start a new Program**. Tick Reserve fuel under Mars orbit insertion, which makes the Mission cost $1.08B, and launch. At Mars, the orbit insertion fails and play stops at a Decision Point. Use Reserve fuel. The second try works, and the orbiter operates with 30% less Service Life. Money ends at $2.22B.
6. **Lost on the way.** Open [Lost on the way](http://localhost:4173/?seed=2) and choose **Start a new Program**. Launch the orbiter. The Mars transfer burn fails the day after launch, and the view moves to the spacecraft to show it, then on to the solar system view. The Turn summary shows money $2.3B to $1.3B and Public Support 100 to 68.
7. **Trajectories.** In Planning Mode, the Trajectory offers Slow, Fast and Free-return. Fast costs $40M and 0.5 t of the Launch Vehicle's capacity, and arrives 60 days sooner, which means more research that Turn and fewer days for a solar particle event to strike. Free-return costs $30M and 0.2 t, and brings an orbiter home for a refund if its Mars orbit insertion fails.

## Judge by eye and ear

The automated tests can't check these, so please look and listen on your own PC:

- The spacecraft view looks like the Mission you launched, and a solar particle event looks like radiation sweeping past.
- A dust storm looks like a storm on the surface, and you can still see what's there.
- The camera moves to the right view at each Decision Point, and staying there to read the choices feels natural.

## Feedback wanted

- **Are Decision Points real trade-offs, or is there always one obvious answer?** In the balance runs, neither answer to any kind always comes out ahead: which is better depends on how the Program is played, for example on Soil analysis or Long traverse, and the margins are small. Which ones did you always answer the same way, and why?
- **How often should they happen?** A careful Program meets one in about three Turns in ten. Too many, too few, or about right? Are any of the four kinds too rare to notice, or so common they get in the way?
- Is a Contingency worth buying? In the balance runs, buying them once a Program is rich earns a little more Science, and buying them from the start costs more than it saves.
- Do you ever choose Fast or Free-return? Fast should pay once you're rich, and Free-return when a first Mission fails, but the edge for Free-return is small.
- Is the spacecraft view worth having, or would you rather stay on the solar system view?
