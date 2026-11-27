/** A blind run's journal, as Markdown to read: what the player made of the game, then where it was puzzled. */
import {
  stopReasonText,
  type BlindPlayReport,
  type BlindStep,
} from "./blindPlay";

const quote = (text: string) =>
  text.trim() ? text.trim().replace(/^/gm, "> ") : "> (nothing)";

/** Runs of this many or more steps in a row that told the player nothing new. */
const blankRun = 4;

function blankStretches(steps: readonly BlindStep[]): BlindStep[][] {
  const stretches: BlindStep[][] = [];
  let current: BlindStep[] = [];
  for (const step of steps) {
    // A step's `learned` says whether the step before it told the player anything.
    if (!step.learned) current.push(step);
    else {
      if (current.length >= blankRun) stretches.push(current);
      current = [];
    }
  }
  if (current.length >= blankRun) stretches.push(current);
  return stretches;
}

export function journalMarkdown(report: BlindPlayReport): string {
  const lines: string[] = [
    "# Blind play: Mars Mission",
    "",
    `- **Player:** ${report.model ? `${report.model.model} (${report.model.provider})` : "scripted"}, prompt ${report.promptVersion}`,
    `- **Seed:** ${String(report.seed)}, Tutorial mode ${report.tutorial}`,
    `- **How it stopped:** ${stopReasonText(report.stopped, report.ending)}`,
    `- **Reached:** Turn ${report.turn === null ? "?" : String(report.turn)} of at most ${String(report.maxTurns)}, in ${String(report.steps.length)} steps of at most ${String(report.maxActions)}`,
    `- **Model use:** ${String(report.usage.calls)} calls, ${String(report.usage.inputTokens)} tokens in, ${String(report.usage.outputTokens)} out`,
  ];
  if (report.error) lines.push(`- **Error:** ${report.error}`);

  lines.push("", "## What the player made of it", "");
  if (report.debrief) {
    lines.push(
      "**What the game is about, and the goal:**",
      "",
      quote(report.debrief.goal),
      "",
      "**How Money, Science, Public Support and risk work:**",
      "",
      quote(report.debrief.rules),
      "",
      "**Why it ended there, and what next:**",
      "",
      quote(report.debrief.ending),
      "",
      "**The most confusing moment:**",
      "",
      quote(report.debrief.confusing),
    );
  } else {
    lines.push("No debrief.");
  }

  lines.push("", "## Where the player was puzzled", "");
  const puzzled = report.steps.filter((step) => step.puzzled);
  if (puzzled.length === 0) lines.push("Nowhere.");
  for (const step of puzzled) {
    lines.push(
      `- **Step ${String(step.number)}, Turn ${step.turn === null ? "?" : String(step.turn)}, ${step.screen}** (before choosing ${step.action}): ${step.puzzled}`,
    );
  }

  lines.push("", "## Where steps told it nothing", "");
  const stretches = blankStretches(report.steps);
  if (stretches.length === 0)
    lines.push(`No ${String(blankRun)} steps in a row.`);
  for (const stretch of stretches) {
    const first = stretch[0];
    const last = stretch.at(-1);
    if (!first || !last) continue;
    lines.push(
      `- **Steps ${String(first.number)}–${String(last.number)}** on ${[...new Set(stretch.map((s) => s.screen))].join(", ")}: ${stretch.map((s) => s.action).join("; ")}`,
    );
  }

  lines.push(
    "",
    "## Notes at the end",
    "",
    quote(report.notes),
    "",
    "## Every step",
    "",
  );
  for (const step of report.steps) {
    lines.push(
      `### ${String(step.number)}. ${step.action}`,
      "",
      `*Turn ${step.turn === null ? "?" : String(step.turn)}, ${step.screen}${step.learned ? "" : ", the last step told it nothing new"}*`,
      "",
      `- **Thinks:** ${step.thinks}`,
      `- **Wants:** ${step.wants}`,
      ...(step.puzzled ? [`- **Puzzled:** ${step.puzzled}`] : []),
      "",
      "```text",
      step.result,
      "```",
      "",
    );
  }
  return `${lines.join("\n")}\n`;
}
