/**
 * Blind play: a model plays the game as a player who has never seen it, choosing one action at a time from what the
 * screen offers and keeping a journal of what it thinks is going on. The journal is the point: it shows whether the
 * game can be understood from the screen alone, where the words confuse, and which steps tell the player nothing.
 *
 * A run is a report to read, never a pass or a fail, and is made only when asked for (`npm run blind-play`); no test
 * suite or CI job runs one.
 */
import type { Game, GameAction, GameScreen } from "./game";

/** What the player is told before it starts: all a new player knows of the game. */
export const blindPlayJob =
  "You are running a Mars exploration Program on a budget. Nobody has explained the rules: work them out from what the game shows you.";

interface RecentStep {
  action: string;
  result: string;
}

/** Everything the player is shown for one choice. */
export interface PlayerView {
  job: string;
  notes: string;
  /** The Turn last shown, or null before the game has shown one. */
  turn: number | null;
  recent: readonly RecentStep[];
  screen: GameScreen;
  /** A word from the harness, such as that the player keeps returning to what it has seen. */
  warning: string | null;
}

export interface PlayerChoice {
  thinks: string;
  wants: string;
  puzzled: string;
  learned: boolean;
  notes: string;
  /** The action's number, counting from 1. */
  choice: number;
}

export interface Debrief {
  /** What the player believes the game is about and what it was trying to achieve. */
  goal: string;
  /** How it believes Money, Science, Public Support and risk work. */
  rules: string;
  /** Why the run ended where it did, and what it would do next. */
  ending: string;
  /** The most confusing moment, or empty. */
  confusing: string;
}

interface Usage {
  inputTokens: number;
  outputTokens: number;
}

export interface Player {
  identity?: { provider: string; model: string };
  choose(view: PlayerView): Promise<{ choice: PlayerChoice; usage?: Usage }>;
  debrief(
    notes: string,
    stopped: string,
  ): Promise<{ debrief: Debrief; usage?: Usage }>;
}

/** One step of a run: the choice made, the journal, and what followed. */
export interface BlindStep {
  number: number;
  turn: number | null;
  /** The screen the choice was made on. */
  screen: string;
  action: string;
  thinks: string;
  wants: string;
  puzzled: string;
  /** Whether the step before this one told the player anything new. */
  learned: boolean;
  /** What the game showed after the action. */
  result: string;
}

export type StopReason =
  | "ended"
  | "turn-limit"
  | "action-limit"
  | "stuck"
  | "no-action"
  | "model-error"
  | "interrupted";

export interface BlindPlayReport {
  promptVersion: string;
  seed: number;
  /** Tutorial mode: off, on, or offered for the player to choose. */
  tutorial: string;
  model?: { provider: string; model: string };
  maxTurns: number;
  maxActions: number;
  stopped: StopReason;
  /** How the Program ended, when it did. */
  ending?: string;
  error?: string;
  /** The last Turn reached. */
  turn: number | null;
  steps: BlindStep[];
  notes: string;
  debrief?: Debrief;
  usage: { calls: number } & Usage;
  /** The actions chosen in order, which `--replay` plays again. */
  trace: string[];
}

export interface BlindPlayOptions {
  game: Game;
  player: Player;
  seed: number;
  /** Tutorial mode: off, on, or offered for the player to choose. */
  tutorial: string;
  promptVersion: string;
  /** The run stops once the game shows a later Turn than this. */
  maxTurns: number;
  maxActions: number;
  /** Called after each step, for progress. */
  onStep?: (step: BlindStep) => void;
  /** Waits while the screen offers nothing, such as while the game loads. */
  idle?: (ms: number) => Promise<void>;
  /** Checked before each step: true stops the run there, as when the person running it presses Ctrl+C. */
  interrupted?: () => boolean;
}

const recentSteps = 6;
const maxNotes = 1_500;
const maxField = 600;
/** After this many steps in a row that only bring back screens already seen, the player is told so, once... */
export const stuckWarning = 8;
/** ...and after this many the run stops as stuck. */
export const stuckStop = 16;
const emptyScreenTries = 10;
/** How many times the player is asked again after choosing a number that isn't an action. */
const invalidChoiceRetries = 2;

const cut = (text: string, limit: number) =>
  text.length > limit ? `${text.slice(0, limit)}…` : text;

export async function playBlind(
  options: BlindPlayOptions,
): Promise<BlindPlayReport> {
  const { game, player } = options;
  const idle =
    options.idle ??
    ((ms: number) => new Promise<void>((done) => setTimeout(done, ms)));
  const steps: BlindStep[] = [];
  const usage = { calls: 0, inputTokens: 0, outputTokens: 0 };
  const count = (used: Usage | undefined) => {
    usage.calls += 1;
    usage.inputTokens += used?.inputTokens ?? 0;
    usage.outputTokens += used?.outputTokens ?? 0;
  };
  let notes = "";
  let turn: number | null = null;
  let stopped: StopReason = "action-limit";
  let ending: string | undefined;
  let error: string | undefined;
  const seen = new Set<string>();
  let sinceNew = 0;
  let warned = false;

  for (let number = 1; number <= options.maxActions; number++) {
    if (options.interrupted?.()) {
      stopped = "interrupted";
      break;
    }
    let screen = await game.read();
    for (let tries = 0; screen.actions.length === 0 && !screen.ended; tries++) {
      if (tries >= emptyScreenTries) break;
      await idle(1_000);
      screen = await game.read();
    }
    if (screen.ended !== null) {
      stopped = "ended";
      ending = screen.ended;
      break;
    }
    if (screen.actions.length === 0) {
      stopped = "no-action";
      break;
    }
    if (screen.turn !== null) turn = screen.turn;
    if (turn !== null && turn > options.maxTurns) {
      stopped = "turn-limit";
      break;
    }
    const warning =
      sinceNew >= stuckWarning && !warned
        ? "You keep coming back to screens you have already seen, without anything new happening. Try something you haven't done yet."
        : null;
    if (warning) warned = true;
    let answer: Awaited<ReturnType<Player["choose"]>> | null = null;
    let action: GameAction | undefined;
    let ask = warning;
    try {
      for (let tries = 0; tries <= invalidChoiceRetries; tries++) {
        answer = await player.choose({
          job: blindPlayJob,
          notes,
          turn,
          recent: steps
            .slice(-recentSteps)
            .map(({ action, result }) => ({ action, result })),
          screen,
          warning: ask,
        });
        count(answer.usage);
        action = screen.actions[answer.choice.choice - 1];
        if (action !== undefined) break;
        ask = `${String(answer.choice.choice)} is not one of the actions. Choose a number from 1 to ${String(screen.actions.length)}.`;
      }
    } catch (caught) {
      stopped = "model-error";
      error = caught instanceof Error ? caught.message : String(caught);
      break;
    }
    if (answer === null || action === undefined) {
      stopped = "no-action";
      error = `The player chose ${String(answer?.choice.choice)}, which is not one of the ${String(screen.actions.length)} actions.`;
      break;
    }
    const { choice } = answer;
    notes = cut(choice.notes, maxNotes);
    const result = await game.act(action);
    const step: BlindStep = {
      number,
      turn,
      screen: screen.name,
      action: action.label,
      thinks: cut(choice.thinks, maxField),
      wants: cut(choice.wants, maxField),
      puzzled: cut(choice.puzzled.trim(), maxField),
      learned: choice.learned,
      result,
    };
    steps.push(step);
    options.onStep?.(step);

    const key = `${screen.text}\n${result}`;
    if (seen.has(key)) sinceNew += 1;
    else {
      seen.add(key);
      sinceNew = 0;
    }
    if (sinceNew >= stuckStop) {
      stopped = "stuck";
      break;
    }
  }

  let debrief: Debrief | undefined;
  if (stopped !== "model-error") {
    try {
      const answer = await player.debrief(
        notes,
        stopReasonText(stopped, ending),
      );
      count(answer.usage);
      debrief = answer.debrief;
    } catch (caught) {
      error = caught instanceof Error ? caught.message : String(caught);
    }
  }

  return {
    promptVersion: options.promptVersion,
    seed: options.seed,
    tutorial: options.tutorial,
    ...(player.identity ? { model: player.identity } : {}),
    maxTurns: options.maxTurns,
    maxActions: options.maxActions,
    stopped,
    ...(ending === undefined ? {} : { ending }),
    ...(error === undefined ? {} : { error }),
    turn,
    steps,
    notes,
    ...(debrief ? { debrief } : {}),
    usage,
    trace: steps.map((step) => step.action),
  };
}

/** Why the run stopped, in words for the player's debrief and the journal. */
export function stopReasonText(stopped: StopReason, ending?: string): string {
  switch (stopped) {
    case "ended":
      return `The Program ended: ${ending ?? "the game ended it"}`;
    case "turn-limit":
      return "Play was stopped after the Turns this session allowed, with the Program still running.";
    case "action-limit":
      return "Play was stopped after the actions this session allowed, with the Program still running.";
    case "stuck":
      return "Play was stopped because many steps in a row brought back only screens already seen.";
    case "no-action":
      return "Play was stopped because no action could be taken.";
    case "model-error":
      return "Play was stopped by an error asking the player.";
    case "interrupted":
      return "Play was stopped by the person running the session, with the Program still running.";
  }
}
