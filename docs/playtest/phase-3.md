# Phase 3 playtest: Landing on Mars

You can now land. Choose between landing straight away and surveying first, carry more than one Asset, and watch Assets wear out or break down. This takes about 20 minutes at 10x speed.

## Run it

You need [Node.js](https://nodejs.org/) 24 or later. In PowerShell, from the repository root (the folder containing this repository's `README.md`), run:

```powershell
.\run.bat
```

The first run installs what it needs. The game then opens in your browser. Press Ctrl+C in the terminal to stop it. Play at 3840×2160 if you can.

## Known seeds

Outcomes normally vary from one Program to the next. To see a particular one, open the game at the address below. If the terminal shows a port other than 4173, use that one instead. If the game offers **Continue this Program**, choose **Start a new Program**, which is what uses the seed.

| Address                                                | What happens, with no Reliability and the shortest Service Life                           |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| [Crash or survey first](http://localhost:4173/?seed=1) | Landing at Jezero Crater on Turn 1 crashes. An orbiter first, then that landing, succeeds |
| [Lucky landing](http://localhost:4173/?seed=3)         | Landing at Jezero Crater on Turn 1 succeeds                                               |
| [Crash after surveying](http://localhost:4173/?seed=4) | An orbiter arrives on Turn 1, and landing at Jezero Crater on Turn 2 still crashes        |
| [Failure in service](http://localhost:4173/?seed=15)   | An orbiter arrives on Turn 1 and breaks down on Turn 2, whether or not you launch         |

Without `?seed=` in the address, each new Program gets its own seed, as in normal play.

## Scenario

1. **Land straight away.** Open [Crash or survey first](http://localhost:4173/?seed=1). Planning Mode shows Turn 1, $2.3B, 100 Public Support and "$1B at 250 (150 away)" for the next Funding Threshold. Under Assets, untick Pathfinder Orbiter and tick Prospector Lander. A Landing Site choice appears, with Jezero Crater and Gale Crater, each marked as not surveyed. Entry/descent/landing shows "Over 30%" and the total cost reads $1.1B.
2. **Crash.** Choose Launch Mission, then 10x. When the Mission reaches Mars, the view moves to Mars orbit by itself. "Entry/descent/landing failed" appears in the failure colour with its sound and says the lander crashed at Jezero Crater. The Turn summary shows money $2.3B to $1.2B and Public Support 100 to 68. That still leaves enough for a retry of either kind.
3. **Survey first.** Open the same address again and choose **Start a new Program**. Launch the Pathfinder Orbiter, which is what's chosen at the start, for $1B. In Mission Mode, press **Mars orbit** and **Solar system** to switch views at any time, at any speed. When the orbiter arrives, the view moves to Mars orbit and shows it going round. The events column adds First orbiter at Mars, Survey from orbit and a Funding Threshold. The Turn summary shows money $2.3B to $2.3B and Public Support 100 to 255.
4. **Land after a Survey.** Turn 2 shows "$1.5B at 450 (195 away)". Under Operating at Mars, the orbiter has 330 days of Service Life left. Choose only the Prospector Lander. Entry/descent/landing now shows "~10%", the sites are marked as surveyed, and there is a third, Meridiani Planum. Choose Jezero Crater and launch.
5. **See it pay off.** The view moves to Mars orbit for the landing. On that Turn, the orbiter's Service Life ends, with a dated entry that costs nothing, and it leaves Operating at Mars. The lander earns First landing on Mars and First landing at Jezero Crater. The Turn summary shows money $2.3B to $2.7B, Public Support 255 to 429, and 270 Science, with Utopia Planitia revealed by the orbiter's last Survey.
6. **Choose your view.** During a Turn, switch to **Solar system** after the view has moved on arrival. It stays there until the next Mission Event with a view of its own. The events column and the outcome don't change.
7. **Too heavy.** On the next Turn, tick both the orbiter and the lander. Mass reads 5.5 of 4 tonnes, a problem says it's too heavy, and Launch Mission is disabled. Choose Meridian Heavy, and it reads 5.5 of 8 tonnes for $2.2B. Launching them together needs only one launch, but a failed orbit insertion loses the lander too. Launch it if you want to, and if the lander crashes the orbiter carries on.
8. **Service Life and Reliability for an Asset.** For the orbiter, choose the longer Service Life and watch the total cost rise. Change its Reliability, and its Risk Band per Turn falls from "~10%".
9. **Failure in service.** Open [Failure in service](http://localhost:4173/?seed=15), start a new Program and launch the orbiter. On Turn 2, choose End Turn without launching. Partway through, "Pathfinder Orbiter failed" appears in the failure colour with its sound, and the Turn summary lists it as failed in service. There is no extra loss of Public Support.
10. **Saves.** Save to a Save Slot on any Turn, reload the page and load it. Survey progress, the sites you've landed at, and each Asset's time left are unchanged. Saves from Phase 1 and Phase 2 still load.

## Judge by eye and ear

The automated tests can't check these, so please look and listen on your own PC:

- The Mars orbit view is easy to follow, and the camera moves smoothly between views.
- The landing marker in the Mars orbit view reads as a landing. It is deliberately simple.
- The Mission panel, with both Assets chosen, is still easy to read at 4K.

## Feedback wanted

- Is the opening choice between surveying and landing interesting?
- Is Service Life a good trade-off? A lander does nothing after landing in this phase, so a longer Service Life on one only pays off in later phases. Is that confusing?
- Is carrying an orbiter and a lander together ever worth it?
- Does early failure in service feel fair, or does it feel like constant replacement?
