# Phase 7 playtest: First Crew

You can now send people to Mars. A Crewed Mission carries named Crew, a Crew size you choose, and the Supplies and Protection you buy for them. It is too heavy for anything but the Meridian Colossus, so it needs that Launch Vehicle developed first. Crew go to Mars orbit or land at a Landing Site, and earn Ongoing Research there, each Crew member earning the Activity's rate. Each has a Health value, which radiation on the way and at Mars, time at Mars, rescues, solar particle events, dust storms and running out of Supplies lower. Protection slows what radiation takes. In this phase Crew never come home from Mars: they stay until their Health runs out, and losing them costs a large drop in Public Support. Only a Free-return, when the arrival burn fails, brings them home alive. This takes about 25 minutes at 10x speed.

## Run it

You need [Node.js](https://nodejs.org/) 24 or later. In PowerShell, from the repository root (the folder containing this repository's `README.md`), run:

```powershell
.\run.bat
```

The first run installs what it needs. The game then opens in your browser. Press Ctrl+C in the terminal to stop it. Play at 3840×2160 if you can.

## Known seeds

Outcomes normally vary from one Program to the next. To see a particular one, open the game at the address below. If the terminal shows a port other than 4280, use that one instead. If the game offers **Continue this Program**, choose **Start a new Program**, which is what uses the seed.

Each seed plays the same first four Turns of the scenario below, then a Crewed Mission of two Crew on Turn 5, with no Reliability, the least Supplies and no Protection.

| Address                                                      | What happens on Turn 5                                                                                                                       |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| [Crew arrive safely](http://localhost:4280/?seed=3)          | The Crew reach Mars orbit and earn the First Crew at Mars Milestone. Their Health runs out on Turn 6                                         |
| [Crew lost at arrival](http://localhost:4280/?seed=33)       | On the Slow Trajectory, Mars orbit insertion fails and the Crew are lost with the Mission                                                    |
| [Crew home on a Free-return](http://localhost:4280/?seed=33) | The same seed on the Free-return Trajectory: Mars orbit insertion fails, and the Mission swings back to Earth and brings the Crew home alive |

Without `?seed=` in the address, each new Program gets its own seed, as in normal play. None of these seeds stops at a Decision Point on the Turns below.

## Scenario

1. **A rover that pays for the Crew.** Open [Crew arrive safely](http://localhost:4280/?seed=3). Tick the Trailblazer Rover, leave Jezero Crater as the Landing Site and Soil analysis as its Activity, and choose its longer Service Life, 2800 days ($300M). The Mission costs $1.7B. Launch it and choose 10x. It lands, and the Turn summary shows money $2.3B to $3.88B, with $200M of base funding, and Public Support 100 to 388.
2. **Develop the Meridian Colossus.** On Turn 2, start Development of the Meridian Colossus ($1.2B over 2 Turns) and choose End Turn without launching, then End Turn. The Turn summary shows money $3.88B to $3.715B, after the rover's Research Grant, Upkeep and base funding.
3. **Wait for it.** On Turns 3 and 4, choose End Turn without launching each time. Turn 3's summary says the Development finished, and money reaches $4.75B. On Turn 4 the rover's Service Life ends, and the Turn ends with $5.685B and Public Support 256.
4. **A Crewed Mission.** On Turn 5, choose the Meridian Heavy as the Launch Vehicle and tick Crewed Mission aboard the Odyssey. Even the smallest Crew, 2, with the least Supplies weighs 11.5 tonnes, more than it can carry. Choose the Meridian Colossus, tagged Unproven at $1.1B. Hover over Health 100 each: Amara Okafor and Lena Petrova fly, and radiation on the way would leave them 79 as they reach Mars, more with Protection. The Supplies list says how many days each would last this Crew. Leave everything else as it is: the Mission costs $4.2B. Launch, and watch the Crew arrive in Mars orbit and earn the First Crew at Mars Milestone. The Turn summary shows money $5.685B to $3.971B and Public Support 256 to 657, the Crew at Health 45, and what each lost to radiation in flight, radiation at Mars and time at Mars.
5. **Crew don't last.** On Turn 6, Operating at Mars lists the Crew in Mars orbit, at Health 45, with Supplies for 2,345 days. Choose End Turn without launching. Their Health runs out during the Turn, and the Turn summary says they were lost when their Health ran out, which cost 150 Public Support. Public Support goes from 657 to 451.
6. **Crew lost at arrival.** Open [Crew lost at arrival](http://localhost:4280/?seed=33) and choose **Start a new Program**. Play steps 1 to 3 as before, with the same results. On Turn 5, before launching, choose Save and save to Save Slot 1. Then set up the Crewed Mission as in step 4 and launch it. Mars orbit insertion fails and the Crew are lost: the events column says so, with a sound of its own. The Turn summary shows money $5.685B to $1.735B and Public Support 256 to 73: 20 for the failure and 150 for the Crew.
7. **Crew home on a Free-return.** Choose Load, and load Save Slot 1, which takes you back to Turn 5. Set up the same Crewed Mission, but choose the Free-return Trajectory, which costs $30M more. Launch. Mars orbit insertion fails again, but this time the Mission swings back to Earth, and the Turn summary lists Amara Okafor and Lena Petrova as Crew home safe, who won't fly again, after losing 63 Health each to radiation on the long way round. Since Phase 8, Crew who come home safe earn Public Support, 100 each, and the First Crew home Milestone, whose Science also earns the 700 Science Milestone, so Public Support goes from 256 to 897 and the Program is paid three Funding Thresholds, ending with $8.205B.

## Judge by eye and ear

The automated tests can't check these, so please look and listen on your own PC:

- The Crew row in the New Mission panel makes Crew size, destination, Activity, Supplies and Protection easy to choose, and the Health tag's tooltip says enough to choose Protection.
- The Odyssey looks like a crewed ship in each view, and a Crew landing, once you try one, plays as a landing of its own, with the Crew stepping out to work when it touches down.
- Losing Crew sounds and reads like the serious event it is.
- The Turn summary makes it clear who lost how much Health, and why.

## Feedback wanted

- **Do Crew feel worth their huge cost?** In the balance runs, a Program that lands its Crew once it is rich earns more Science than one that keeps to Assets, even filling the Meridian Heavy, but keeping Crew in Mars orbit earns less than spending the same money on Assets. Every Crewed Mission spends money that Assets would have earned back as Research Grants. Did you feel your Crew paid for themselves?
- **Does losing Crew hurt as it should?** Each Crew member lost costs Public Support, on top of the failure's own, and in this phase every Crew member at Mars is lost in the end. In the balance runs, the Programs rich enough to fly Crew have enough Public Support that losing them seldom cancels the Program, and soon after a loss Research Grants matter more than Public Support. Did a loss feel like a disaster, a setback, or hardly anything?
- **Are the crewed costs reachable, given the money curve?** In the balance runs, Crew fly in about three in ten Programs, from Turn 10 at the earliest and Turn 11 or 12 on average, once the Program has been rich enough to develop the Meridian Colossus and fly it. The scenario above reaches them on Turn 5 by saving up. When could you first afford a Crewed Mission, and did getting there feel like a goal or a grind?
- Did you buy Supplies and Protection, and did the choice feel real? The largest Crew can't carry the most of both. In the balance runs, the most Supplies pay off only with Protection that keeps Crew alive long enough to use them: without Protection, the least Supplies earn as much Science, for less money. Protection without the Supplies to live on is wasted the same way.
