# Game design decisions

The game rules settled so far, grouped by area. Vocabulary follows [GLOSSARY.md](../GLOSSARY.md); platform and fidelity decisions are in [docs/adr/](adr/). Items marked _open_ are still being decided.

## Program and Turns

- A Program is open-ended. In practice it winds down when the player runs out of worthwhile things to build or do.
- A Program ends when the player retires it or when Public Support falls to zero and it is cancelled. Either way, a Program summary shows total Science and the Milestones achieved.
- A late-game goal is to build up enough that the Program carries on indefinitely, producing enough money and Public Support with little input from the player.
- At most one Mission is launched per Turn, as a single journey. This keeps Mission Mode buildable.
- A Mission ends when it has delivered its Assets and Crew, or has failed. After that they operate at Mars on their own, so Mission Mode shows the Turn's Mission plus everything already operating.
- If assembling or refuelling in Earth orbit needs several launches, those launches and rendezvous are Mission Events within the one Mission.
- The Launch Vehicle is chosen from the catalogue and sets how much mass the Mission can carry.
- In Planning Mode the player gives each Asset and Crew one Activity for the Turn.
- Each Turn begins at a Launch Window (roughly every 26 months) and consists of Planning Mode followed by Mission Mode.
- No game time passes in Planning Mode. Mission Mode runs from one Launch Window to the next, showing every Mission in flight and every operating Asset together. Time speeds up and slows down automatically for Mission Events and Decision Points.
- Missions can overlap Turns. For example, a Crewed Mission that stays on the surface for a long time lasts about 2.5 years, so the next Turn's Planning Mode happens while Crew are still at Mars.
- Doing everything in a single Mission ("one jump") is possible but very expensive and risky. Building up Assets over several Turns is the intended cheaper path.
- Robotic and Crewed Missions are both available. Crewed Missions cost much more and earn more Public Support.

## Assets

- Players choose pre-designed Assets from a catalogue. There is no assembly from parts.
- Assets stay at Mars and keep working into later Turns, within reason: each has a limited Service Life, and longer Service Life costs more.
- An Asset may fail before its Service Life ends. This is a probability that Reliability lowers.
- No repairs or Service Life extensions in the first version.
- A spacecraft that can make the round trip costs more than a one-way one.

## Landing Sites

- Mars has named Landing Sites. Each has a landing risk, a Science value and resources such as water ice.
- Sites become available only through a Survey from orbit. Surveying also lowers a site's landing risk.

## Risk and Safety Margin

- Each Mission is a sequence of Mission Events, and each Event has a failure probability.
- Safety Margin comes in three kinds:
  - Reliability (testing, redundancy) lowers an Event's failure probability.
  - Contingency (escape module, abort fuel) changes the outcome when an Event fails. Decision Points are often where a Contingency is used.
  - Protection (radiation shielding) reduces harm to Crew that builds up over the Mission's Duration.
- All Safety Margin is worth having but expensive.
- Failure probabilities are shown to the player as rough bands (for example "~5%"), not exact figures.
- The random seed is fixed when the Program starts, so reloading a save can't re-roll an outcome.
- Mission Mode also has Hazards: random environmental dangers such as dust storms (less solar power, risk to Assets) and solar particle events (radiation, reduced by Protection). They are separate from planned Mission Events and can create Decision Points.

## Science

- Science is the score. It is weighted heavily towards activity at Mars itself, for example 100 for an orbiter surveying landing sites and 1000 for returning samples to Earth.
- Science comes from two sources:
  - Milestones: one-off achievements, such as returning a sample.
  - Ongoing Research: a steady rate earned only while an Asset or Crew is actively doing the work, such as analysing fresh soil samples in a lab on Mars. The rate doesn't decline over time.
- Science already earned is never taken away.
- Earning Science pays money. Late in a Program this is the main income, and Public Support matters less. Like a rover mission, public excitement peaks early and fades while the Science carries on. _Open: how the payment works._

## Public Support and money

- Milestones award Public Support points.
- When Public Support reaches a Funding Threshold, it pays a fixed sum. For example, 100 points plus 200 for putting an orbiter at Mars crosses the 300-point threshold, which pays $1 billion.
- Each Funding Threshold pays only the first time it is reached. Falling below and climbing back pays nothing.
- There is no regular Appropriation. Running out of money through poor management is a way for the player to fail.
- There is no separate bankruptcy rule. A player with no money lets Turns pass without launching, and Public Support drains until the Program is cancelled, unless what they've built keeps it going. Cancellation is the only way to lose.
- Public Support drains slowly over time.
- Costs are in millions of dollars, at roughly real-world scale.

## Crew

- Crew are named, with no other individual traits.
- Losing Crew causes a large drop in Public Support. The only Science cost is that the Ongoing Research they were doing stops.
- Crew don't have to come home. Staying at Mars harms them through radiation and other effects.
- Bringing Crew home safely earns a large amount of Public Support. Every safe return earns it, and the first return is also a Milestone worth more.
- A later Mission can fetch Crew already at Mars if it carries a return vehicle.
- Each Crew member has a single Health value. Radiation, time at Mars and failed Mission Events lower it, Protection slows the decline, and at zero they die.
- Crew need Supplies. When Supplies run out, Health falls quickly.

## Technology

- Every technology is visible from the start, labelled with its Technology Readiness. The best technology takes development time and money before it can fly, and is less reliable until it has flown successfully.
- Development is paid for up front in Planning Mode and takes a set number of Turns. After its first successful use, a technology is Flight-proven: cheaper and more reliable.
