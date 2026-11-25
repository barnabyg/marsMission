# Journey home playtest

From the repository root with Node.js 24 or newer installed, run:

```powershell
npm.cmd run playtest:journey
```

Choose a scenario in the launcher. In Planning Mode tick the option to send the samples or bring the Crew home, then choose **End Turn without launching**. Select **20x** in Mission Mode. Compare the event cards with **Mission Events** in the Turn summary.

| Scenario                   | What to follow                                                                                                                                                                                                                                                                                              |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Samples home               | The Kestrel Lifter rises from Jezero Crater and leaves its launch platform beside the rover. The sample carrier docks with the Albatross Orbiter above Mars. The orbiter burns for Earth. Its small capsule returns under one parachute. The summary names the orbiter, the samples and the Science earned. |
| Crew home from the surface | The cabin leaves the descent stage by the fuel plant and docks with the Earth return stage. Its engine lights above Mars. The capsule returns under three parachutes and floats beside the recovery ship. Look for Amara Okafor and Lena Petrova in the summary.                                            |
| Crew home from Mars orbit  | The first homeward scene is Trans-Earth injection. Pause at ignition, then choose **Skip scene**. The calendar stays paused and the solar system shows the route home. Resume at **20x** for Earth entry.                                                                                                   |

Choose **Failed sample ascent**, **Failed Mars rendezvous**, **Failed departure** or **Failed Earth entry**. Watch for the ascent vehicle falling beside its platform, the rendezvous collision, the departure engine cutting out above Mars, or a capsule breaking up before its parachute opens. After the failed departure plays, or when you skip its scene, Mars orbit shows a red marker labelled **Albatross Orbiter: stranded in Mars orbit** for the rest of the Turn. Operating at Mars lists the surviving active Assets. Each Turn ends its homeward event list at the failure and accounts for the lost samples.

Select **Backup engine decision** and choose **Skip to Decision Point**. Read the choices. Using the Backup engine in this scenario lets the Albatross Orbiter depart and reach Earth. Replay the same scenario and choose **Don't use it** to see the failed departure and the samples stranded in Mars orbit.

## Visual review

On 25 November 2026, the surface Crew flew from Jezero Crater through splashdown in Chromium at both desktop sizes. These are full Mission Mode frames taken with playback paused. The ascent shot shows Odyssey lifting clear of its descent stage beside Wellspring. The departure shot shows the lit engine above Mars. At splashdown, the capsule, crane and recovery ship all fit in the view. The event column stays visible throughout.

| Shot                                | 1920×1080                                               | 3840×2160                                               |
| ----------------------------------- | ------------------------------------------------------- | ------------------------------------------------------- |
| Crew leaving Jezero                 | [Ascent](../screenshots/homeward-ascent-1080.jpg)       | [Ascent](../screenshots/homeward-ascent-2160.jpg)       |
| Earth return stage ignition         | [Burn](../screenshots/homeward-burn-1080.jpg)           | [Burn](../screenshots/homeward-burn-2160.jpg)           |
| Crew capsule under three parachutes | [Descent](../screenshots/homeward-chutes-1080.jpg)      | [Descent](../screenshots/homeward-chutes-2160.jpg)      |
| Recovery ship and capsule           | [Splashdown](../screenshots/homeward-recovery-1080.jpg) | [Splashdown](../screenshots/homeward-recovery-2160.jpg) |

The successful Crew summaries named Amara Okafor and Lena Petrova. In the sample-return flight, the carrier approached the Albatross Orbiter and reached Earth. In the failed-departure flight the engine went dark above Mars, and the summary recorded 18 samples lost at Trans-Earth injection. [Sample rendezvous at 1080p](../screenshots/homeward-sample-docking-1080.jpg) · [Stranded orbiter at 4K](../screenshots/homeward-stranded-2160.jpg)
