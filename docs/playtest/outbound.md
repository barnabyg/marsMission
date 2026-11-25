# Earth departure playtest

From the repository root on Windows with Node.js 24 or later, run:

```powershell
npm.cmd run playtest:journey
```

Use the fixture selector to start each case in Planning Mode. For the four Meridian Colossus cases choose that vehicle, tick Pathfinder Orbiter, Prospector Lander and Trailblazer Rover, and keep Jezero Crater and the default Reliability. Launch and select **20x**.

| Scenario              | What to look for                                                                                                                                                                                                                                                                                                                                                      |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Orbital refuelling    | The outbound Colossus clears the tower. A second rocket with a blunt, orange-banded propellant tank leaves the same pad. The camera cuts to the waiting three-Asset stack, then closes on the docking collars. Propellant flows while they are joined. The Tanker pulls away before the upper stage ignites above Earth's blue limb and the Mission accelerates away. |
| Tanker launch failure | The Tanker breaks apart above the pad. The cut back to orbit shows all three Assets intact on the stranded Mission. The summary ends at Tanker launch.                                                                                                                                                                                                                |
| Docking collision     | The Tanker closes too fast, hits the upper stage, and tumbles away with the wreckage. The summary records the collision.                                                                                                                                                                                                                                              |
| Transfer cutoff       | After refuelling the upper stage fires, cuts off early and coasts with the payload still attached. The event and summary record the failed burn.                                                                                                                                                                                                                      |
| Kick stage decision   | Choose the Meridian Medium and only Pathfinder Orbiter. Buy the Kick stage Contingency. Play at 20x to the Decision Point. The engine stays off until you answer. Choose **Use Kick stage** to see it fire and depart. Reload the same fixture and choose **Don't use it** to see the failed trajectory instead.                                                      |

Pause during approach. The two vehicles and their separation hold. Resume and listen for one docking sound at contact. Try **Steady camera** for a wide shot of the two vehicles together. **Skip scene** advances past the current shot and preserves your chosen speed. Continue through arrival and compare the Mission Events in the Turn summary with the scenes you saw.
