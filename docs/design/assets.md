# Assets and Landing Sites

Part of the [game design](../game-design.md), whose Status says which of these rules are built. Balance figures here are examples; the game's values are in [public/data](../../public/data). Vocabulary follows [GLOSSARY.md](../../GLOSSARY.md).

## Assets

- Players choose pre-designed Assets from a catalogue. There is no assembly from parts.
- Assets stay at Mars and keep working into later Turns, within reason: each has a limited Service Life, and longer Service Life costs more.
- An Asset may fail before its Service Life ends, in any Turn after the one it arrives in. This is a probability that Reliability lowers, bought separately for each Asset. For now it costs no Public Support, which playtesting may change.
- No repairs or Service Life extensions in the first version.
- Each Asset at Mars costs a small Upkeep, set in the data files, for each Turn it is kept going after the one it arrives in, until its Service Life ends. It comes out of Money as the Turn starts, before the Mission and any Development. In Planning Mode the player can end an Asset's mission instead, which takes it out of service as the Turn starts, so that it costs no Upkeep, does no research and gives no Benefit from then on. A Turn can't end while the Upkeep of the Assets kept is more than the Money, until enough of their missions are ended. Crew at Mars cost no Upkeep yet.
- Planning Mode starts each Turn's Mission with no Asset chosen, so that one already at Mars never looks as if it has to be launched again. An Asset with one or more of itself operating at Mars is tagged with how many, and Operating at Mars comes first beside the Mission.
- Assets give each other a limited set of specific benefits, defined in the catalogue. For example, a relay orbiter raises the Ongoing Research rate of everything on the surface, a fuel plant makes a return journey possible and a habitat lets Crew stay longer.
- A Benefit is defined in the data files on the Asset that gives it: what it raises and by what percentage. The first is a relay orbiter's, which raises the Ongoing Research of every Asset and Crew on the surface: its Science and Public Support, and so its Research Grant. An orbiter's own research isn't raised, and nor is that of Crew in Mars orbit.
- A Benefit applies on each day the Asset giving it operates at Mars, whatever its Activity, from the day it arrives until it fails or its Service Life ends. Benefits that raise the same thing don't add up: on each day the largest applies, so a second relay orbiter adds nothing.
- An Asset on the surface earns at the raised rate on the days that are raised and at the usual rate on the others, and its Science and Public Support are rounded up once for the Turn, as usual. Its Science and Public Support build up faster on raised days, so Science Milestones and Funding Thresholds can come sooner, and sheltering from a dust storm gives up the raised rate for the storm's days.
- Planning Mode tags each Asset that gives a Benefit with the Science it would add over a whole Turn, going by the Assets and Crew doing research on the surface as the Turn starts, and the tag's tooltip describes the Benefit and says what it would raise, or why it would add nothing: nothing on the surface is doing research, or an Asset at Mars already gives as much. Planning Mode also shows the raised rate for an Asset on the surface while an Asset giving the Benefit is operating with Service Life left as the Turn starts, or is on the Turn's Mission. That figure is for a whole Turn, so it doesn't allow for one arriving, failing or ending partway. The Turn summary says how much of each Asset's Ongoing Research a Benefit added, and the balance report how much Science Benefits earned.
- Nothing about Benefits is saved: which Assets are operating is saved already, and what each gives comes from the data files.
- A spacecraft that can make the round trip costs more than a one-way one.

## Landing Sites

- Mars has named Landing Sites. Each has a landing risk and a Science value, earned by the first successful landing there. Resources such as water ice are left out until a rule uses them.
- Apart from the two starting sites, Landing Sites become available only through a Survey from orbit. Surveying also lowers a site's landing risk.
- Surveying is an Activity. In each Turn an Asset operates at Mars with Survey as its Activity, every known site drops to its surveyed risk in one step, and the next site in the catalogue becomes known. A second surveying Asset doesn't speed this up, and with none there is no Survey.
- A newly chosen Asset starts on the first Activity it lists in the data files, so an orbiter surveys, and a lander or a rover does research, unless the player chooses otherwise. It starts on the day it is delivered, and an Asset that is lost never starts.
- A rover lands at a Landing Site just as a lander does, and stays around it. The named sites are thousands of kilometres apart, and earning first-landing Science by driving would undercut landers. Its Activities are a choice between Science and money: soil analysis earns less Science and pays a Research Grant, and a long traverse earns more Science and pays none.
- A rover and a lander can share a Mission. They go through one entry/descent/landing together, at one Landing Site, each with its own Activity, and a crash loses both. Whichever lands first earns First landing on Mars, and the first rover also has a Milestone of its own.
- Crew can land with them too, through the same entry/descent/landing at the same Landing Site, as the Crew section says.
- An Asset keeps its Activity from Turn to Turn until the player changes it, so a large Program doesn't need re-setting every Turn.
