# Mission Mode, saving, art and sound

Part of the [game design](../game-design.md), whose Status says which of these rules are built. Balance figures here are examples; the game's values are in [public/data](../../public/data). Vocabulary follows [GLOSSARY.md](../../GLOSSARY.md).

## Mission Mode

- A Turn takes about 20 minutes at 1x speed, with controls to speed it up to 5x or 10x, or to pause it. Pausing only affects how a Turn is shown and lasts only for that Turn, because choosing a speed is what ends it and the next Turn starts at the speed last chosen.
- The graphics are a mix of pre-made animations (such as an asteroid strike on a base) and displays (such as orbital tracking of a journey).
- Pre-made animations are scripted 3D sequences that run live in the game, not pre-rendered video, so they show the Assets the player actually bought at the Landing Site they actually chose.
- The first animation goal is one success and one failure animation per kind of Mission Event, and one per Hazard. More will follow. Each Mission Event, Milestone and Funding Threshold is added to an events column beside the view when it happens, with its date, title and description, newest at the top, and stays until the Turn ends. Nothing needs dismissing and time keeps running, so the player pauses to read. A failure stands out in the failure colour and plays its sound. A successful launch or Tanker launch plays the launch sound, and a Rendezvous its own. Losing Crew, whatever the cause, plays a sound of its own.
- Play pauses at each Decision Point with no time limit. What raises one is under [Risk and Safety Margin](risk.md#risk-and-safety-margin).
- Mission Mode has four views, with smooth camera transitions between them:
  - Solar system: Earth, Mars and the Mission's journey along its Trajectory.
  - Mars orbit: orbiting Assets, arrival, aerocapture.
  - Surface: a Landing Site, with landings, rovers and bases.
  - Spacecraft: a close-up of the Mission in transit, used when something happens on the way: a solar particle event or a failed Mars transfer burn. A Mission with Orbital refuelling is shown in Earth orbit until it leaves for Mars, with its Tanker climbing from Earth, docking to refuel and pulling away, or colliding with it.
- The view switches automatically for Mission Events and Hazards, and the player can switch views at any time.
- A landing or crash plays for a few seconds of real time, the same at every speed, and pausing holds it. It only displays what has already been worked out. After a crash, the view goes back to whichever Landing Site still has something to show, or else to Mars orbit.
- A Crewed Mission has a ship of its own in every view: ringed in the solar system and in Mars orbit, a crew vehicle with a capsule in the spacecraft view, including in Earth orbit and through a solar particle event, and a lander of its own at a Landing Site. Its landing and crash are Crew landings and Crew crashes, which play as the others do. The Crew stay aboard until it touches down, then step out and work in front of it, moving about as their Activity has them do, or standing by it with nothing to do. They go indoors while they shelter from a dust storm, and each is gone from the day they're lost. Crew who land where Crew already are join them, coming down in a lander of their own beside the first, and each lander stands while any of the Crew it brought are there. Mission Mode moves to the surface for a Crew landing or crash, and to the spacecraft view for a solar particle event with Crew aboard, as it does without them.
- A Rendezvous, and the Tanker launch before it, play the same way. Once the Rendezvous has played, the view goes back to where it was before, or to the solar system if that was the spacecraft view and the Mission is lost.

## Saving

- The game saves automatically at the start of each Planning Mode.
- A few manual save slots are available, usable only in Planning Mode. Saving partway through Mission Mode isn't possible, so a reload always returns to the start of a Turn. What that can and can't undo is under [Risk and Safety Margin](risk.md#risk-and-safety-margin).

## Art, sound and onboarding

- Mars and the planets use NASA's public imagery and elevation data. Spacecraft use NASA's free 3D models where they fit, plus simple models made for the project. Plumes, dust and explosions are generated in code. Licensing rules are in [ADR 0005](../adr/0005-free-open-licensed-media-only.md).
- The first version has simple sound effects and no music.
- There is no guided tutorial in the first version. Every term has a tooltip instead, except in button labels.
