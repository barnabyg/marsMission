import { describe, expect, it } from "vitest";
import {
  playBlind,
  stuckStop,
  stuckWarning,
  type Player,
  type PlayerView,
} from "./blindPlay";
import type { Game, GameAction, GameScreen } from "./game";
import { journalMarkdown } from "./journal";
import { createScriptedPlayer } from "./modelPlayer";

/** A tiny game: Planning with Launch and a term, Mission Mode with Wait, then the next Turn's Planning, or an ending. */
function testGame(
  endAfterTurn: number | null = null,
): Game & { done: string[] } {
  let turn = 1;
  let mode: "planning" | "mission" | "ended" = "planning";
  const done: string[] = [];
  const planning: GameAction[] = [
    { label: 'Press "Launch Mission"', kind: "click" },
    { label: 'Hover over "Money" to read its tooltip', kind: "hover" },
  ];
  const mission: GameAction[] = [
    { label: "Wait and watch what happens", kind: "wait" },
  ];
  return {
    done,
    read: () =>
      Promise.resolve<GameScreen>(
        mode === "ended"
          ? {
              name: "Program summary",
              turn: null,
              text: "",
              actions: [],
              ended: "The Program has been cancelled.",
            }
          : {
              name: mode === "planning" ? "Planning Mode" : "Mission Mode",
              turn: mode === "planning" ? turn : null,
              text: `${mode} ${String(turn)}`,
              actions: mode === "planning" ? planning : mission,
              ended: null,
            },
      ),
    act: (action) => {
      done.push(action.label);
      if (action.kind === "click") mode = "mission";
      else if (action.kind === "wait") {
        if (endAfterTurn === turn) mode = "ended";
        else {
          turn += 1;
          mode = "planning";
        }
      } else return Promise.resolve("The tooltip says: Money: what you spend.");
      return Promise.resolve(`Now ${mode}`);
    },
  };
}

const options = { seed: 7, tutorial: "off", promptVersion: "test" };
const noIdle = () => Promise.resolve();

describe("blind play", () => {
  it("plays the actions chosen until the game shows a later Turn than allowed", async () => {
    const game = testGame();
    const report = await playBlind({
      ...options,
      game,
      player: createScriptedPlayer([
        'Hover over "Money" to read its tooltip',
        'Press "Launch Mission"',
        "Wait and watch what happens",
        'Press "Launch Mission"',
        "Wait and watch what happens",
      ]),
      maxTurns: 2,
      maxActions: 50,
    });
    expect(report.stopped).toBe("turn-limit");
    expect(report.turn).toBe(3);
    expect(report.trace).toEqual(game.done);
    expect(report.steps.map((step) => [step.turn, step.screen])).toEqual([
      [1, "Planning Mode"],
      [1, "Planning Mode"],
      [1, "Mission Mode"],
      [2, "Planning Mode"],
      [2, "Mission Mode"],
    ]);
    expect(report.steps[0]?.result).toBe(
      "The tooltip says: Money: what you spend.",
    );
  });

  it("stops at the Program's ending and says how it ended", async () => {
    const report = await playBlind({
      ...options,
      game: testGame(1),
      player: createScriptedPlayer([
        'Press "Launch Mission"',
        "Wait and watch what happens",
      ]),
      maxTurns: 5,
      maxActions: 50,
      idle: noIdle,
    });
    expect(report.stopped).toBe("ended");
    expect(report.ending).toBe("The Program has been cancelled.");
    expect(report.debrief).toBeDefined();
  });

  it("shows the player its notes and last steps, and keeps its journal", async () => {
    const views: PlayerView[] = [];
    let step = 0;
    const player: Player = {
      identity: { provider: "test", model: "m" },
      choose(view) {
        views.push(view);
        step += 1;
        return Promise.resolve({
          choice: {
            thinks: `thinks ${String(step)}`,
            wants: "to launch",
            puzzled: step === 1 ? "What is Money for?" : "",
            learned: step !== 2,
            notes: `notes ${String(step)}`,
            choice: step === 1 ? 2 : 1,
          },
          usage: { inputTokens: 100, outputTokens: 10 },
        });
      },
      debrief: (notes, stopped) =>
        Promise.resolve({
          debrief: {
            goal: `goal from ${notes}`,
            rules: "rules",
            ending: stopped,
            confusing: "",
          },
          usage: { inputTokens: 50, outputTokens: 5 },
        }),
    };
    const report = await playBlind({
      ...options,
      game: testGame(),
      player,
      maxTurns: 5,
      maxActions: 3,
    });
    expect(report.stopped).toBe("action-limit");
    expect(views[1]?.notes).toBe("notes 1");
    expect(views[2]?.recent.map((recent) => recent.action)).toEqual([
      'Hover over "Money" to read its tooltip',
      'Press "Launch Mission"',
    ]);
    expect(report.usage).toEqual({
      calls: 4,
      inputTokens: 350,
      outputTokens: 35,
    });
    expect(report.debrief?.goal).toBe("goal from notes 3");
    expect(report.model).toEqual({ provider: "test", model: "m" });

    const journal = journalMarkdown(report);
    expect(journal).toContain("- **Player:** m (test)");
    expect(journal).toContain(
      '- **Step 1, Turn 1, Planning Mode** (before choosing Hover over "Money" to read its tooltip): What is Money for?',
    );
    expect(journal).toContain("> goal from notes 3");
  });

  it("stops when interrupted, and still asks for the debrief", async () => {
    let steps = 0;
    const report = await playBlind({
      ...options,
      game: testGame(),
      player: createScriptedPlayer([
        'Hover over "Money" to read its tooltip',
        'Press "Launch Mission"',
      ]),
      maxTurns: 5,
      maxActions: 50,
      onStep: () => (steps += 1),
      interrupted: () => steps >= 1,
    });
    expect(report.stopped).toBe("interrupted");
    expect(report.steps).toHaveLength(1);
    expect(report.debrief).toBeDefined();
  });

  it("warns once and then stops a player that only goes back to screens it has seen", async () => {
    const views: PlayerView[] = [];
    const player: Player = {
      choose(view) {
        views.push(view);
        return Promise.resolve({
          choice: {
            thinks: "",
            wants: "",
            puzzled: "",
            learned: false,
            notes: "",
            choice: 2,
          },
        });
      },
      debrief: () =>
        Promise.resolve({
          debrief: { goal: "", rules: "", ending: "", confusing: "" },
        }),
    };
    const report = await playBlind({
      ...options,
      game: testGame(),
      player,
      maxTurns: 5,
      maxActions: 100,
    });
    expect(report.stopped).toBe("stuck");
    expect(report.steps).toHaveLength(stuckStop + 1);
    expect(views.filter((view) => view.warning !== null)).toHaveLength(1);
    expect(views[stuckWarning + 1]?.warning).not.toBeNull();
    expect(journalMarkdown(report)).toContain("## Where steps told it nothing");
  });

  it("stops on a model error, or a choice that isn't offered after asking again, with no debrief after an error", async () => {
    const failing: Player = {
      choose: () => Promise.reject(new Error("timed out")),
      debrief: () => Promise.reject(new Error("not asked")),
    };
    const errored = await playBlind({
      ...options,
      game: testGame(),
      player: failing,
      maxTurns: 5,
      maxActions: 10,
    });
    expect(errored).toMatchObject({
      stopped: "model-error",
      error: "timed out",
    });
    expect(errored.debrief).toBeUndefined();

    const warnings: (string | null)[] = [];
    const outOfRange: Player = {
      ...failing,
      choose: (view) => {
        warnings.push(view.warning);
        return Promise.resolve({
          choice: {
            thinks: "",
            wants: "",
            puzzled: "",
            learned: true,
            notes: "",
            choice: 9,
          },
        });
      },
      debrief: () =>
        Promise.resolve({
          debrief: { goal: "", rules: "", ending: "", confusing: "" },
        }),
    };
    const report = await playBlind({
      ...options,
      game: testGame(),
      player: outOfRange,
      maxTurns: 5,
      maxActions: 10,
    });
    expect(report.stopped).toBe("no-action");
    expect(report.error).toContain("chose 9");
    // Asked twice more, told what it may choose, before the run stops.
    expect(warnings).toEqual([
      null,
      "9 is not one of the actions. Choose a number from 1 to 2.",
      "9 is not one of the actions. Choose a number from 1 to 2.",
    ]);
    expect(report.usage.calls).toBe(4);
  });
});
