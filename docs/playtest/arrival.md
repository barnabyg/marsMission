# Mars arrival playtest

From the repository root, with Node.js 24 or newer installed, run:

```powershell
npm.cmd run playtest:journey
```

Choose an arrival scenario, launch its Mission, and select **20x**. The event cards and playback controls stay available during each shot. **Pause** holds the spacecraft in place. **Skip scene** advances past that shot. A Decision Point waits for an answer.

| Mission          | What to check                                                                                                                                                                                                                                                               |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Orbiter capture  | Pathfinder fires its braking engine across the limb of Mars, then follows the curve into orbit. The Turn summary records Mars orbit insertion. The orbiter flies no landing.                                                                                                |
| Orbiter flyby    | The burn cuts off and the spacecraft passes Mars. No orbiter starts operating.                                                                                                                                                                                              |
| Free-return      | Select the Free-return Trajectory for Pathfinder. With Reserve fuel on board, decline it at the Decision Point. The flyby gives way to the homeward track and the summary records the refund.                                                                               |
| Surface delivery | Send the Prospector Lander to Jezero Crater. Watch the glowing heat shield, separation into powered descent, then the lander standing on the same terrain.                                                                                                                  |
| Surface crash    | Fly the Prospector plan again with the crash setup. The descent tips, the impact throws dust and the wreck stays on screen. Check the site and payload against the failure card.                                                                                            |
| Crew landing     | Use the prepared Program with a fuel plant at Jezero. Send the smallest Crew aboard the Colossus with Light shielding on a round trip to that site. The crew lander arrives beside the existing Wellspring Fuel Plant. The Crew stay inside until touchdown, then step out. |

## Visual review

Reviewed paused Chromium frames at 1920×1080 and 3840×2160. The 1080p pass exposed clipping at the start of atmospheric entry. The updated camera keeps the entire aeroshell and the falling payload in frame. The 4K pass covered the insertion burn, engine cutoff, aeroshell, powered descent, tilted descent, wreck and standing lander. The event card stayed beside the scene at 20x.
