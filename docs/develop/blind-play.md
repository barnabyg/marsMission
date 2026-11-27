# Blind play

Part of the developer docs; [README.md](../../README.md) has the code map, the commands and the checks.

Blind play has a live model play the game in a browser as a player who has never seen it, keeping a journal as it goes. It answers what the tests and balance runs can't: whether the game can be worked out from the screen alone, where the words confuse, and which steps tell the player nothing. Run this from the repository root, with `OPENAI_API_KEY` set:

```powershell
npm.cmd run blind-play -- --model gpt-6-luna --live
```

- **Only when asked for.** It calls OpenAI, so it needs `--live` and `OPENAI_API_KEY`, and no test suite, gate or CI job runs it. Its tests drive the loop with a scripted player (`src/blindPlay/*.test.ts`) and check the browser adapter against the real game (`e2e/blindPlay.spec.ts`).
- **What the player sees.** It's told only that it runs a Mars exploration Program on a budget. Then for each step it sees the screen as a screen reader reads it: Playwright's accessibility snapshot, with `[disabled]`, `[checked]` and `[selected]` marked. It also sees a numbered list of what it can do, its own notes, and its last six steps with what each changed on screen. While a dialog is open, it sees only the dialog.
- **What it can do.** It can press any button that can be used, tick or untick a box, set a select to any other option, and hover over a game term to read its tooltip. In Mission Mode it can also wait and watch: playback runs until the events, the screen or a dialog changes, or for `--wait-ms`. It chooses one action a step. Controls that can't be used aren't offered, but the snapshot shows them and the game's reason. If it chooses a number that isn't offered, it's asked again twice.
- **What it doesn't see.** Pictures, the 3D views and the layout: only text. It can use a control below the fold without scrolling, which a player couldn't.
- **Tutorial mode.** `--tutorial off`, the default, takes Tutorial mode's offer off the page, so the game's own words are tested. `on` turns it on before play starts, to judge its advice. `choose` leaves the offer for the player, as for any new player.
- **The journal.** With each choice the player says what it thinks is going on, what it wants next and why, what puzzled it, and whether its last step told it anything new. At the end it's asked what the game is about and what the goal was, how Money, Science, Public Support and risk work, why play ended where it did, and what confused it most.
- **When a run stops.** It stops when the Program ends, when the game shows a later Turn than `--turns` (default 3), or after `--max-actions` steps (default 60 a Turn, at least 150), or when you press Ctrl+C, which still asks for the debrief and writes the report. It also stops as stuck after 16 steps in a row that only bring back screens already seen, having been told once after 8, or on a model error.
- **The report** goes to `.scratch/blind-play/` (ignored), or `--output`: `journal.md` to read, `report.json`, and `trace.json`. Each step is also added to `steps.jsonl` as it is played, so a run cut short keeps its journal so far. `npm.cmd run blind-play -- --replay <trace.json> --headed` plays a trace's actions again in a browser you can watch, and leaves it open at the end.
- **The game** runs on its own development server, on port 5391 unless `--port` is given, with Mission Mode `--time-scale` times faster (default 10) so that waiting costs less. Landings and other sequences play at their normal speed. It runs at 1920×1080, on a new Program with `--seed` (default 1) and no saves.
- **A report, not a verdict.** Runs differ from one to the next. Read two or three before changing the game because of what one says.
- **Cost and time.** Each step sends the whole screen, about 3,000 to 5,000 tokens for Planning Mode. A Turn takes the player 10 to 60 steps, and a step about 20 seconds with gpt-6-luna. Its first two-Turn run took 27 calls, 99,000 tokens in and 14,000 out, in about ten minutes.
