# Phase 4 playtest: Doing Science

Assets at Mars now do something after they arrive. Give each one an Activity, land a rover, watch it on the surface, and see the money move from Public Support to Research Grants. This takes about 20 minutes at 10x speed.

## Run it

You need [Node.js](https://nodejs.org/) 24 or later. In PowerShell, from the repository root (the folder containing this repository's `README.md`), run:

```powershell
.\run.bat
```

The first run installs what it needs. The game then opens in your browser. Press Ctrl+C in the terminal to stop it. Play at 3840×2160 if you can.

## Known seeds

Outcomes normally vary from one Program to the next. To see a particular one, open the game at the address below. If the terminal shows a port other than 4173, use that one instead. If the game offers **Continue this Program**, choose **Start a new Program**, which is what uses the seed.

| Address                                                   | What happens, with no Reliability and the shortest Service Life                                                      |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| [Rover and Research Grant](http://localhost:4173/?seed=3) | A rover lands at Jezero Crater on Turn 1, and Soil analysis pays a Research Grant that Turn and the next             |
| [Crash, or Survey first](http://localhost:4173/?seed=1)   | A rover or a lander crashes at Jezero Crater on Turn 1. An orbiter first, then a lander, then a rover, all get there |

Without `?seed=` in the address, each new Program gets its own seed, as in normal play.

## Scenario

1. **Choose a rover.** Open [Rover and Research Grant](http://localhost:4173/?seed=3). Planning Mode shows Turn 1, $2.3B, 100 Public Support and "$1B at 250 (150 away)" for the next Funding Threshold. Under Assets, untick Pathfinder Orbiter and tick Trailblazer Rover. The total cost reads $1.4B, and entry/descent/landing shows "Over 30%". Its Activity starts on Soil analysis, and the text under the Mission says Soil analysis earns 80 Science and 9 Public Support and pays an $800M Research Grant, and Long traverse earns 160 Science and 14 Public Support. Service Life offers 1300 days for nothing or 2800 days for $300M. Leave them, with Jezero Crater as the Landing Site.
2. **Land.** Choose Launch Mission, then 10x. When the Mission reaches Mars, the view moves to the surface by itself and plays the landing. The rover then drives around near where it landed, and the panel beside the view says "Trailblazer Rover (rover): Soil analysis". The events column adds First landing on Mars, First rover on Mars and two Funding Thresholds. The Turn summary shows money $2.3B to $3.98B, Public Support 100 to 388, 388 Science, and a Research Grant of $580M.
3. **The next Turn.** Turn 2 shows "$2B at 630 (242 away)". Under Operating at Mars, the rover has 735 days of Service Life left. Launch the orbiter, which leaves the rover on Soil analysis, and choose 10x. The Turn summary shows money $3.98B to $3.74B and Public Support 388 to 507, with a Research Grant of $760M and the rover's Service Life ended, as you bought the shortest. If you change it to Long traverse instead, it pays no Research Grant, earns more Science and drives much further.
4. **Crash.** Open [Crash, or Survey first](http://localhost:4173/?seed=1) and choose **Start a new Program**. Choose the same rover and launch it. This time the landing sequence ends in a crash, "Entry/descent/landing failed" appears in the failure colour with its sound, and the wreck lies on the surface while the sequence plays. When the sequence ends, the view moves to Mars orbit, which says "Trailblazer Rover: crashed at Jezero Crater", and the Surface button is disabled, because nothing else has landed. The Turn summary shows money $2.3B to $900M and Public Support 100 to 68. On Turn 2, nothing can be launched, because the cheapest Mission costs $1B. A rover straight away pays most when it works, and leaves no retry when it doesn't. A lander that crashes here leaves $1.2B, which is enough for a retry.
5. **Survey first.** Open the same address again, choose **Start a new Program** and launch the Pathfinder Orbiter. The Turn summary shows money $2.3B to $2.3B and Public Support 100 to 255. On Turn 2, under Operating at Mars, the orbiter's Activity offers Survey, Orbital research and Nothing, and the text says Orbital research earns 80 Science and 6 Public Support. Leave it on Survey. Launch the Prospector Lander alone to Jezero Crater, where entry/descent/landing now shows "~10%".
6. **Early research pays little.** That Turn summary shows money $2.3B to $2.737B and Public Support 255 to 435, with 343 Science. Most of the money is the second Funding Threshold, and the Research Grant is only $37M.
7. **Research starts to pay.** On Turn 3, launch the rover to Meridiani Planum. The Turn summary shows money $2.737B to $3.965B and Public Support 435 to 553. First rover on Mars and 700 Science earned take Public Support past the third Funding Threshold, and Research Grants come to $628M.
8. **Research pays most.** On Turn 4, choose End Turn without launching. There is no Funding Threshold this time, and the $760M Research Grant is all the income: money $3.965B to $4.725B. The lander has gone, and the rover's Service Life ends during this Turn.
9. **Nothing left.** On Turn 5, nothing is operating at Mars. Choose End Turn without launching. Money stays at $4.725B and Public Support falls from 477 to 405. Keep ending Turns like this and the Program fades until it is cancelled, however much money it has.
10. **Saves.** Save to a Save Slot on any Turn, reload the page and load it. Each Asset's Activity and time left are unchanged. Saves from earlier phases still load, and an Asset in one keeps the Service Life it was bought with, even if that isn't on offer now.

## Judge by eye and ear

The automated tests can't check these, so please look and listen on your own PC:

- The surface view looks like a place on Mars, and the camera shows what you want to see.
- The landing sequence reads as a landing and the crash sequence as a crash, each with sound that fits.
- A rover on Long traverse visibly goes further than one on Soil analysis, and its motion looks like driving.
- Planning Mode, with Operating at Mars full of Assets, is still easy to read at 4K.

## Feedback wanted

- Is there enough to do each Turn?
- Does the shift from Public Support money to Research Grant money feel right?
- Is a longer Service Life a good trade-off now? It should be worth buying for a rover that pays Research Grants, and often not for an orbiter or a lander. Does that come across?
- Is Reliability for an Asset worth thinking about, or do you ignore it or always buy it?
- Do you change Activities? Is the choice between Soil analysis and Long traverse, and between Survey and Orbital research, a real one?
- Once Research Grants are coming in, does money pile up with nothing left to spend it on? This phase has little to buy late in a Program.
