# Phase 1 playtest: First Orbiter

Send an orbiter to Mars, earn a Milestone and a payout, and carry on until you retire or are cancelled. This takes about 10 minutes at 10x speed.

## Run it

You need [Node.js](https://nodejs.org/) 24 or later. In PowerShell, from the repository root (the folder containing this repository's `README.md`), run:

```powershell
npm.cmd start
```

The first run installs what it needs. The game then opens in your browser. Press Ctrl+C in the terminal to stop it. Play at 3840×2160 if you can.

## Scenario

1. **Start.** Planning Mode shows Turn 1, December 2028, $2B, 100 Public Support, 0 Science. The next Funding Threshold reads "$1B at 300 (200 away)". Hover over any underlined term to see what it means.
2. **Launch.** The Mission's total cost reads $1B. Choose Launch Mission.
3. **Watch.** Mission Mode shows Earth, Mars, the route and the spacecraft, with the Launch and Mars transfer burn text screens over the view. Choose 10x. The spacecraft speeds up, but each text screen still stays up for about 8 seconds, or until you choose Continue.
4. **Arrive.** At about the end of June 2029 you see Mars orbit insertion, then First orbiter at Mars, then the Funding Threshold payout. Under Operating at Mars, Pathfinder Orbiter appears, and a small marker circles Mars.
5. **Turn summary.** Once the Turn ends, the Turn summary shows the Milestone, the $1B payout, money $2B to $2B, 100 Science, and Public Support 100 to 255 (200 gained, 45 faded).
6. **Next Turn.** Planning Mode shows Turn 2, January 2031, with the Milestone listed and "None left" for the next Funding Threshold.
7. **Repeat.** Launch a second orbiter. There is no Milestone this time, and the Turn summary shows money $2B to $1B and Public Support 255 to 216.
8. **Retire.** Choose Retire Program and confirm. The Program summary shows 100 total Science and First orbiter at Mars. Choose Start a new Program.
9. **Optional: get cancelled.** Choose End Turn without launching, and let each Turn pass at 10x. Public Support goes 85, 72, 61, 51, 43. At 43 the Program is cancelled, and the Turn summary and Program summary both say why. Each Turn takes about 2 minutes at 10x.

## Judge by eye

The automated tests can't check these, so please look at them on your own PC:

- The planets, route and labels look sharp at 4K. Mars's map is 1024 pixels wide, so say if it looks soft.
- The view plays without visible stutter at every speed.

## Feedback wanted

- Does the Turn loop make sense?
- Does watching the journey hold your attention?
- Is 20 minutes at 1x right? Nothing happens after arrival in this phase, so also say how the long quiet stretch feels.
