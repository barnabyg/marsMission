import type { TurnRecord } from "./playProgram";
import { sum } from "./sum";

// How the report writes numbers and tables, shared by its sections.

export const mean = (values: number[]) =>
  values.length > 0 ? sum(values) / values.length : 0;
export const percent = (part: number, whole: number) =>
  whole > 0 ? ((100 * part) / whole).toFixed(1) : "-";
export const whole = (value: number) => String(Math.round(value));
export const tenth = (value: number) => value.toFixed(1);

/** Lines of a fixed-width table: the first column on the left and the rest on the right. */
export function table(headers: string[], rows: string[][]): string[] {
  const widths = headers.map((header, column) =>
    Math.max(header.length, ...rows.map((row) => row[column]?.length ?? 0)),
  );
  return [headers, ...rows].map((row) =>
    row
      .map((cell, column) =>
        column === 0
          ? cell.padEnd(widths[column] ?? 0)
          : cell.padStart(widths[column] ?? 0),
      )
      .join("  "),
  );
}

/** Mean Science, money and cancellations at the end of these Programs, as table cells. */
export function ending(plays: TurnRecord[][]): string[] {
  const last = plays.flatMap((play) => play.at(-1) ?? []);
  return [
    whole(mean(last.map((turn) => turn.science))),
    whole(mean(last.map((turn) => turn.moneyMillions))),
    percent(last.filter((turn) => turn.cancelled).length, last.length),
  ];
}
