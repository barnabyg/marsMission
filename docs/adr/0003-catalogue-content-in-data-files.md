# Catalogue content lives in data files, not code

Assets, Launch Vehicles, technologies, Landing Sites, Milestones, Research Grant rates, Funding Thresholds and Hazards are defined in data files, separate from the game code. The game code holds rules and behaviour; the data files hold names and numbers. We chose this because balancing a game like this is mostly adjusting numbers, and being able to rebalance without touching code matters more than the extra structure it costs. The alternative was hard-coding content in TypeScript.

## Consequences

- Adding a new Asset of an existing kind should need only a data change. A new kind of behaviour still needs code.
- Data files need validation when they are loaded, so a typo in a number fails loudly instead of quietly unbalancing the game.
