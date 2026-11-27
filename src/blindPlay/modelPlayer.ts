/**
 * The blind player as a model: what it is told, what it is shown each step, and the answers it must give. Also the
 * player that replays a run's trace.
 */
import type { Debrief, Player, PlayerChoice, PlayerView } from "./blindPlay";
import type { StructuredModel } from "./model";

export const blindPlayerPromptVersion = "mars-blind-player-v1";

const blindPlayerPrompt = [
  "You are playing a strategy game in a web browser for the first time. You know nothing about it beyond what the game shows you.",
  "Each turn you are shown the job you were given, your own notes, what happened in your last few steps, and the screen as a screen reader reads it: headings, text, values and controls, with [disabled] on controls that can't be used and [checked] or [selected] on chosen ones. Under it is a numbered list of the actions you can take. Choose one by its number.",
  "Hovering over a game term shows its tooltip, as it would for a player with a mouse. Use that when a word or number puzzles you, but don't read every tooltip for its own sake.",
  "Play as a curious, sensible person would: try to understand what the game wants of you, plan with care, and decide for yourself what is worth doing. When a Mission is playing out, you can watch it, change its speed or skip ahead, as a player would.",
  "With each choice, keep an honest journal. Say what you now think is going on, and what you want next and why. If anything confused you, contradicted something you were told, promised something that was not there, or seemed to have no purpose, say exactly what; if nothing did, leave that empty. Say whether your last step told you anything new.",
  "Your notes are your only memory beyond the last few steps. Rewrite them each turn to hold what you have learned about the rules, where your Program stands, and what you mean to do.",
].join("\n\n");

const debriefPrompt =
  "You have just finished playing a strategy game for the first time. Answer from what you saw and noted while playing, and nothing else.";

const text = (description: string) => ({ type: "string", description });

const choiceSchema = {
  type: "object",
  additionalProperties: false,
  required: ["thinks", "wants", "puzzled", "learned", "notes", "choice"],
  properties: {
    thinks: text("What you now think is going on, in a sentence or two."),
    wants: text("What you want next, and why."),
    puzzled: text(
      "Exactly what confused you, contradicted something, promised something that was not there or seemed pointless, or empty if nothing did.",
    ),
    learned: {
      type: "boolean",
      description: "Whether your last step told you anything new.",
    },
    notes: text(
      "Your notes, rewritten: what you know of the rules, where your Program stands, what you mean to do.",
    ),
    choice: {
      type: "integer",
      description: "The number of the action you take.",
    },
  },
};

const debriefSchema = {
  type: "object",
  additionalProperties: false,
  required: ["goal", "rules", "ending", "confusing"],
  properties: {
    goal: text(
      "What the game is about, and what you think you were meant to achieve.",
    ),
    rules: text(
      "How you believe Money, Science, Public Support and risk work, and what earns or costs each.",
    ),
    ending: text(
      "Why play ended where it did, how well you think your Program was doing, and what you would do next.",
    ),
    confusing: text("The most confusing moment of the game, or empty."),
  },
};

/** What the player is shown for one choice. */
export function viewText(view: PlayerView): string {
  const parts = [
    `Your job: ${view.job}`,
    `Your notes:\n${view.notes || "(none yet)"}`,
  ];
  if (view.recent.length > 0) {
    parts.push(
      `Your last steps:\n${view.recent
        .map(
          (step) => `- ${step.action}\n  ${step.result.replace(/\n/g, "\n  ")}`,
        )
        .join("\n")}`,
    );
  }
  if (view.warning) parts.push(`Note: ${view.warning}`);
  parts.push(`The screen: ${view.screen.name}\n${view.screen.text}`);
  parts.push(
    `Actions:\n${view.screen.actions
      .map((action, index) => `${String(index + 1)}. ${action.label}`)
      .join("\n")}`,
  );
  return parts.join("\n\n");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asChoice(value: unknown): PlayerChoice {
  if (
    isRecord(value) &&
    typeof value.thinks === "string" &&
    typeof value.wants === "string" &&
    typeof value.puzzled === "string" &&
    typeof value.learned === "boolean" &&
    typeof value.notes === "string" &&
    typeof value.choice === "number"
  ) {
    return {
      thinks: value.thinks,
      wants: value.wants,
      puzzled: value.puzzled,
      learned: value.learned,
      notes: value.notes,
      choice: value.choice,
    };
  }
  throw new Error("The model's choice didn't have the expected fields.");
}

function asDebrief(value: unknown): Debrief {
  if (
    isRecord(value) &&
    typeof value.goal === "string" &&
    typeof value.rules === "string" &&
    typeof value.ending === "string" &&
    typeof value.confusing === "string"
  ) {
    return {
      goal: value.goal,
      rules: value.rules,
      ending: value.ending,
      confusing: value.confusing,
    };
  }
  throw new Error("The model's debrief didn't have the expected fields.");
}

export function createModelPlayer(model: StructuredModel): Player {
  return {
    identity: model.identity,
    async choose(view) {
      const answer = await model.ask({
        instructions: blindPlayerPrompt,
        input: viewText(view),
        name: "take_action",
        description: "Choose one action and keep your journal.",
        schema: choiceSchema,
      });
      const choice = asChoice(answer.value);
      return answer.usage ? { choice, usage: answer.usage } : { choice };
    },
    async debrief(notes, stopped) {
      const answer = await model.ask({
        instructions: debriefPrompt,
        input: `${stopped}\n\nYour notes as they stood at the end:\n${notes || "(none)"}`,
        name: "debrief",
        description: "Say what you made of the game.",
        schema: debriefSchema,
      });
      const debrief = asDebrief(answer.value);
      return answer.usage ? { debrief, usage: answer.usage } : { debrief };
    },
  };
}

/**
 * A player that takes the actions of a trace in order, by their labels, and stops when they run out or one isn't on
 * the screen. It replays a run to look at a moment again, and drives the loop in tests.
 */
export function createScriptedPlayer(actions: readonly string[]): Player {
  let next = 0;
  return {
    choose(view) {
      const label = actions[next++];
      const index =
        label === undefined
          ? -1
          : view.screen.actions.findIndex((action) => action.label === label);
      if (index < 0) {
        return Promise.reject(
          new Error(
            label === undefined
              ? "The script has no more actions."
              : `"${label}" is not on the screen.`,
          ),
        );
      }
      return Promise.resolve({
        choice: {
          thinks: "",
          wants: "",
          puzzled: "",
          learned: true,
          notes: "",
          choice: index + 1,
        },
      });
    },
    debrief() {
      return Promise.resolve({
        debrief: { goal: "", rules: "", ending: "", confusing: "" },
      });
    },
  };
}
