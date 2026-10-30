# Simulation runs separately from the graphics

The game rules run as a self-contained, deterministic simulation with no dependence on Three.js or React. Mission Mode only displays what the simulation produces, using pre-made animations (such as an asteroid strike on a base) and displays (such as orbital tracking of a journey). Graphics never decide an outcome. We chose this so the rules can be tested without a browser and thousands of Programs can be run automatically to check the balance. The alternative, letting Mission Mode's scene drive events directly, would tie every rule to a running renderer.

## Consequences

- Each simulation result needs something to show it. A new kind of Mission Event or Hazard can start with a text message screen, which an animation can replace later without changing the rules.
