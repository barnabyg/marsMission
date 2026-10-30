# Game design decisions

The game rules settled so far, grouped by area. Vocabulary follows [GLOSSARY.md](../GLOSSARY.md); platform and fidelity decisions are in [docs/adr/](adr/). Items marked _open_ are still being decided.

## Program and Turns

- A Program is open-ended. In practice it winds down when the player runs out of worthwhile things to build or do.
- A Program ends when the player retires it or when Public Support falls to zero and it is cancelled. Either way, a Program summary shows total Science and the Milestones achieved.
- A late-game goal is to build up enough that the Program carries on indefinitely, producing enough money and Public Support with little input from the player.
- At most one Mission is launched per Turn, as a single journey. This keeps Mission Mode buildable.
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

## Risk and Safety Margin

- Each Mission is a sequence of Mission Events, and each Event has a failure probability.
- Safety Margin comes in three kinds:
  - Reliability (testing, redundancy) lowers an Event's failure probability.
  - Contingency (escape module, abort fuel) changes the outcome when an Event fails. Decision Points are often where a Contingency is used.
  - Protection (radiation shielding) reduces harm to Crew that builds up over the Mission's Duration.
- All Safety Margin is worth having but expensive.
- Failure probabilities are shown to the player as rough bands (for example "~5%"), not exact figures.
- The random seed is fixed when the Program starts, so reloading a save can't re-roll an outcome.

## Science

- Science is the score. It is weighted heavily towards activity at Mars itself, for example 100 for an orbiter surveying landing sites and 1000 for returning samples to Earth.
- Science comes from two sources:
  - Milestones: one-off achievements, such as returning a sample.
  - Ongoing Research: a steady rate earned only while an Asset or Crew is actively doing the work, such as analysing fresh soil samples in a lab on Mars. The rate doesn't decline over time.
- Science already earned is never taken away.

## Public Support and money

- Milestones award Public Support points.
- When Public Support reaches a Funding Threshold, it pays a fixed sum. For example, 100 points plus 200 for putting an orbiter at Mars crosses the 300-point threshold, which pays $1 billion.
- Each Funding Threshold pays only the first time it is reached. Falling below and climbing back pays nothing.
- There is no regular income. Running out of money through poor management is a way for the player to fail.
- Public Support drains slowly over time.
- Costs are in millions of dollars, at roughly real-world scale.

## Crew

- Crew are named, with no other individual traits.
- Losing Crew causes a large drop in Public Support. The only Science cost is that the Ongoing Research they were doing stops.
- Crew don't have to come home. Staying at Mars harms them through radiation and other effects.
- Bringing Crew home safely earns a large amount of Public Support.

## Technology

- Every technology is visible from the start, labelled with its Technology Readiness. The best technology takes development time and money before it can fly, and is less reliable until it has flown successfully.
