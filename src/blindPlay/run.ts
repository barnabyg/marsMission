/**
 * One blind run in a browser page that already shows the game: sets Tutorial mode as asked, plays, and returns the
 * report with its journal. `scripts/blind-play.mjs` starts the game and the browser around it.
 */
import type { Page } from "@playwright/test";
import { playBlind, type BlindPlayReport, type BlindStep } from "./blindPlay";
import { createBrowserGame, hideTutorialOffer } from "./browserGame";
import { journalMarkdown } from "./journal";
import { createOpenAiModel } from "./model";
import {
  blindPlayerPromptVersion,
  createModelPlayer,
  createScriptedPlayer,
} from "./modelPlayer";

/** Off: its offer is taken off the page. On: turned on before play starts. Choose: offered, as to any new player. */
export type TutorialChoice = "off" | "on" | "choose";

export interface BlindRunOptions {
  page: Page;
  seed: number;
  tutorial: TutorialChoice;
  maxTurns: number;
  maxActions: number;
  waitMs: number;
  /** A live model, or the actions of a trace to replay. */
  player:
    | {
        kind: "openai";
        apiKey: string;
        model: string;
        reasoningEffort?: string;
      }
    | { kind: "replay"; actions: string[] };
  onStep?: (step: BlindStep) => void;
  interrupted?: () => boolean;
}

/** The most steps a run is given unless told otherwise: 60 a Turn, and at least 150. */
export function defaultMaxActions(maxTurns: number): number {
  return Math.max(150, 60 * maxTurns);
}

export async function runBlindPlay(
  options: BlindRunOptions,
): Promise<{ report: BlindPlayReport; journal: string }> {
  const { page } = options;
  if (options.tutorial === "off") await hideTutorialOffer(page);
  if (options.tutorial === "on") {
    await page.getByRole("button", { name: "Turn on Tutorial mode" }).click();
  }
  const game = createBrowserGame(page, {
    waitMs: options.waitMs,
  });
  const player =
    options.player.kind === "openai"
      ? createModelPlayer(
          createOpenAiModel({
            apiKey: options.player.apiKey,
            model: options.player.model,
            ...(options.player.reasoningEffort === undefined
              ? {}
              : { reasoningEffort: options.player.reasoningEffort }),
          }),
        )
      : createScriptedPlayer(options.player.actions);
  const report = await playBlind({
    game,
    player,
    seed: options.seed,
    tutorial: options.tutorial,
    promptVersion: blindPlayerPromptVersion,
    maxTurns: options.maxTurns,
    maxActions: options.maxActions,
    ...(options.onStep ? { onStep: options.onStep } : {}),
    ...(options.interrupted ? { interrupted: options.interrupted } : {}),
  });
  return { report, journal: journalMarkdown(report) };
}
