# Phase 8 playtest: Coming Home

Crew and samples can now come back to Earth. A Crewed Mission can go on a round trip, carrying an Earth return stage that waits in Mars orbit and brings its Crew home on a later Turn you choose, through the journey home's own Mission Events. Crew who land need ascent propellant for Mars ascent, which a fuel plant makes at their Landing Site, and a return vehicle can fetch Crew who went one way. A rover can cache samples, which an ascent vehicle and an Earth return orbiter fly home. Each Crew member home safe earns Public Support, samples earn Science once home, and the first of each are a Milestone. A habitat lets Crew at its Landing Site last longer, and a Mars lab raises the Research Grants of the rovers and Crew beside it, so that a base can pay for itself. This takes about 30 minutes at 10x speed.

## Run it

You need [Node.js](https://nodejs.org/) 24 or later. In PowerShell, from the repository root (the folder containing this repository's `README.md`), run:

```powershell
.\run.bat
```

The first run installs what it needs. The game then opens in your browser. Press Ctrl+C in the terminal to stop it. Play at 3840×2160 if you can.

## Known seeds

Outcomes normally vary from one Program to the next. To see a particular one, open the game at the address below. If the terminal shows a port other than 4173, use that one instead. If the game offers **Continue this Program**, choose **Start a new Program**, which is what uses the seed.

| Address                                                      | What happens                                                                                                     |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| [Samples returned to Earth](http://localhost:4173/?seed=233) | Steps 1 to 3: a rover caches samples, and on Turn 3 they come home and earn the First samples returned Milestone |
| [Crew home safe](http://localhost:4173/?seed=233)            | Steps 4 to 6: round-trip Crew reach Mars orbit on Turn 5 and come home safe on Turn 6                            |
| [Crew lost on the way home](http://localhost:4173/?seed=413) | Step 7: the same Turns, but on Turn 6 Earth entry fails and the Crew are lost on the way home                    |

Without `?seed=` in the address, each new Program gets its own seed, as in normal play. None of these seeds stops at a Decision Point on the Turns below.

## Scenario

1. **A rover that caches samples.** Open [Samples returned to Earth](http://localhost:4173/?seed=233). Tick the Trailblazer Rover, leave Jezero Crater as the Landing Site, choose Sample caching as its Activity and its longer Service Life, 2800 days ($300M). The Mission costs $1.7B. Launch it and choose 10x. It lands and starts caching, and the Turn summary shows 8 samples cached at Jezero Crater, money $2.3B to $3.3B and Public Support 100 to 382.
2. **Something to fly them home.** On Turn 2, the Samples step says 8 samples wait at Jezero Crater, and can't go home until an ascent vehicle is there. Choose the Meridian Heavy and tick the Kestrel Lifter and the Albatross Orbiter, both Unproven: together they weigh 7 tonnes, too much for the Meridian Medium. Leave Jezero Crater as the Landing Site. The Mission Events step lists the journey home's own, Mars ascent, Mars orbit rendezvous, Trans-Earth injection and Earth entry, bought with this Mission. It costs $3B. Launch, and choose End Turn. The Turn ends with $535M.
3. **Samples home.** On Turn 3, 18 samples wait at Jezero Crater, worth 1440 Science once home. Tick **Send the samples at Jezero Crater home** and choose End Turn without launching. Watch the Kestrel Lifter lift off at the Landing Site, the rendezvous in Mars orbit, the way home and the capsule splashing down. The Turn summary lists 18 samples from Jezero Crater, brought home by the Albatross Orbiter, earning 1440 Science, the First samples returned Milestone and three Science Milestones. Public Support goes from 324 to 1125, and three Funding Thresholds take the money from $535M to $7.25B.
4. **Ready for Crew.** Open [Crew home safe](http://localhost:4173/?seed=233) and choose **Start a new Program**. Tick the Trailblazer Rover as in step 1, but leave its Activity as Soil analysis, and launch: the Turn ends with $3.88B and Public Support 388. On Turn 2, start Development of the Meridian Colossus ($1.2B over 2 Turns) and choose End Turn without launching. On Turns 3 and 4, choose End Turn without launching each time. Turn 4 ends with $5.685B and Public Support 256.
5. **Crew on a round trip.** On Turn 5, choose the Meridian Colossus and tick Crewed Mission. Leave the Crew size at 2 and tick **Round trip**, which adds the Earth return stage, $600M and 1.5 tonnes, and lists Trans-Earth injection and Earth entry under the Mission Events. Leave everything else as it is: the Mission costs $4.8B. Launch, and watch the Crew arrive in Mars orbit and earn the First Crew at Mars Milestone. The Turn summary shows money $5.685B to $3.371B, Public Support 256 to 657 and the Crew at Health 45.
6. **Crew home safe.** On Turn 6, Operating at Mars lists the Crew in Mars orbit with their way home. Tick **Bring Amara Okafor and Lena Petrova home** and choose End Turn without launching. Their Earth return stage leaves Mars, the solar system view follows them home, and the spacecraft view shows Earth entry and the splashdown. The Turn summary lists them as Crew home safe, earning 200 Public Support and the First Crew home Milestone. Public Support goes from 657 to 985 and two Funding Thresholds take the money from $3.371B to $8.149B.
7. **Crew lost on the way home.** Open [Crew lost on the way home](http://localhost:4173/?seed=413), choose **Start a new Program** and play steps 4 to 6 again, with the same results up to Turn 6. This time Earth entry fails: the capsule breaks up, the events column says the Crew were lost, and the Turn summary shows Public Support 657 to 415, 20 for the failure and 150 for the Crew.

## Judge by eye and ear

The automated tests can't check these, so please look and listen on your own PC:

- Mars ascent, the rendezvous in Mars orbit, the way home and the splashdown read clearly as one journey, and the "Crew" and "Samples" labels over the capsule are easy to read against the bright sky.
- Crew coming home safe sounds and feels like a celebration, and losing them on the way home like the disaster it is.
- The Samples step and the way home in Operating at Mars make it clear what can come home, what it would earn, and why it can't yet.
- A fuel plant, a habitat and a Mars lab look like parts of one base when they land at the same Landing Site.

## Feedback wanted

- **Can a Program become self-sustaining, and does getting there feel like an achievement?** The balance report counts a Program as keeping itself going from the first Turn after which its Research Grants and base funding pay for everything it spends, without money it had saved or Funding Thresholds. In the balance runs, Programs of rovers on Soil analysis get there first, around Turn 8, while Programs that build a crewed base, with a fuel plant, a habitat and a Mars lab beside Crew who come home, get there around Turn 14, and more often than Programs whose Crew land without a base. Did yours get there, and did you notice when it did? Did it feel earned?
- **Is the Program too long or too short?** In the balance runs, a Program first flies Crew around Turn 11, and builds a base for them around Turn 12 to 14, out of the 20 the runs play, which is about 30 game years in. A base takes most of a Program, as feared. How many Turns did you want to play, and did the one Mission a Turn feel like the thing holding you back?
- **Is bringing Crew home worth it?** A round trip costs more and takes Crew away from their research. In the balance runs, Crew who come home from a Landing Site beside a fuel plant, with their samples, earn more than Crew who stay there one way, but Crew in Mars orbit earn more if they stay. At a base, one-way Crew earn the most Science, but losing them cancels the Program far more often. Which did you choose, and why?
- **Are returned samples worth the Missions they take?** The scenario's fast sample return pays very well when it works, but leaves almost no money if anything fails on the way. Did it feel like a gamble worth taking?
