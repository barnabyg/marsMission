# Phase 2 playtest: Things Go Wrong

Missions can now fail. See the risk before launching, buy Reliability, recover from a failure, and keep your Program between sessions. This takes about 15 minutes at 10x speed.

## Run it

You need [Node.js](https://nodejs.org/) 24 or later. In PowerShell, from the repository root (the folder containing this repository's `README.md`), run:

```powershell
.\run.bat
```

The first run installs what it needs. The game then opens in your browser. Press Ctrl+C in the terminal to stop it. Play at 3840×2160 if you can.

## Known seeds

Outcomes normally vary from one Program to the next. To see a particular one, open the game at the address below. If the terminal shows a port other than 4173, use that one instead. If the game offers **Continue this Program**, choose **Start a new Program**, which is what uses the seed.

| Address                                                 | What happens, launching with no Reliability                  |
| ------------------------------------------------------- | ------------------------------------------------------------ |
| [Success](http://localhost:4173/?seed=1)                | The first Mission succeeds                                   |
| [Failure, then recovery](http://localhost:4173/?seed=6) | Launch fails on Turn 1, and the retry on Turn 2 succeeds     |
| [Two failures](http://localhost:4173/?seed=2)           | Mars transfer burn fails, then Launch fails, and it's over   |
| [Avoidable failure](http://localhost:4173/?seed=13)     | Mars orbit insertion fails, unless you buy Reliability on it |

Without `?seed=` in the address, each new Program gets its own seed, as in normal play.

## Scenario

1. **Failure.** Open [Failure, then recovery](http://localhost:4173/?seed=6). Planning Mode shows Turn 1, December 2028, $2.3B, 100 Public Support and "$1B at 250 (150 away)" for the next Funding Threshold.
2. **See the risk.** The Mission panel lists Launch, Mars transfer burn and Mars orbit insertion, each with a Risk Band and never an exact figure. Hover over any underlined term to see what it means. The total cost reads $1B.
3. **Launch.** Choose Launch Mission, leaving Reliability at None. You hear a failure sound, and a "Launch failed" screen says what was lost. Under Operating at Mars it still says "Nothing yet". The spacecraft goes no further, and the panel says it won't reach Mars.
4. **Turn summary.** Choose Continue, then 10x, and wait for the Turn to end, which takes about 2 minutes. The summary states Launch failed, Pathfinder Orbiter lost and 20 Public Support lost, with money $2.3B to $1.3B and Public Support 100 to 68.
5. **Recover.** Choose Continue. Turn 2 shows $1.3B, 68 Public Support and "$1B at 250 (182 away)". Launch again without Reliability. This time you hear the launch sound, then the Milestone and Funding Threshold sounds on arrival. The Turn summary shows $1.3B to $1.3B and Public Support 68 to 227.
6. **Save and reload.** On Turn 3, choose **Save here** on slot 1. It shows Turn 3, March 2033, $1.3B and 227 Public Support. Reload the page and choose **Continue this Program**. You are back on Turn 3 with the same numbers. Save to slot 1 again, and it asks before overwriting.
7. **Buy Reliability.** Open [Avoidable failure](http://localhost:4173/?seed=13) and choose **Start a new Program**. Set Mars orbit insertion to Redundant. Its Risk Band drops and the total cost becomes $1.15B. Launch, and it reaches Mars. Reload during Mission Mode and choose **Continue this Program** to return to the start of the Turn, where Reliability is back to None. Launch again: the same Mission Event now fails on arrival.
8. **Two failures.** Open [Two failures](http://localhost:4173/?seed=2), start a new Program and launch twice with no Reliability. After the second failure Public Support falls to 40, below the Cancellation Level of 50, and the Program is cancelled. Reopening the game doesn't offer to continue it.
9. **Mute.** In Mission Mode, press **Mute sound**. Sounds stop, and the setting is still on after you reload.

## Judge by eye and ear

The automated tests can't check these, so please look and listen on your own PC:

- The Mission panel and Save Slots are easy to read at 4K.
- The sounds suit what they mark, and aren't too loud or annoying. They are simple synthesised effects, so say which ones grate.

## Feedback wanted

- Does spending on Reliability feel like a real choice?
- Do failures feel fair?
- How does it feel that a reload can avoid a failure you have already seen, by buying more Reliability or by not launching at all? Step 7 shows the first of these.
- How does it feel that there is little reason to launch after the first orbiter succeeds?
