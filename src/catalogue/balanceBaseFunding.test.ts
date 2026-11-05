import { describe, expect, it } from "vitest";
import { playProgram, type TurnRecord } from "../balance/playProgram";
import { strategies } from "../balance/strategies";
import { parseCatalogue } from "./catalogue";
import { createSimulation } from "../simulation/simulation";
import { played } from "../testing/playedStrategies";
import { realCatalogueFiles } from "../testing/realCatalogue";

const scienceAtEnd = (play: TurnRecord[]) => play.at(-1)?.science ?? 0;
const cancelled = (play: TurnRecord[]) => play.at(-1)?.cancelled === true;
const meanOf = (values: number[]) =>
  values.reduce((total, value) => total + value, 0) / values.length;

/** The Programs whose first Mission failed. */
const firstMissionFailed = (plays: TurnRecord[][]) =>
  plays.filter(
    (play) => play.find(({ launched }) => launched)?.missionFailed === true,
  );

describe("the balance of base funding", () => {
  const cautious = played("cautious");
  const bold = played("bold");
  // On the real data files and over many seeds, as a cautious first Mission rarely fails. Played here, as a test would
  // take longer than a test may.
  const cautiousOnRealFiles = (() => {
    const real = createSimulation(parseCatalogue(realCatalogueFiles()));
    const strategy = strategies.find(({ name }) => name === "cautious");
    if (!strategy) throw new Error("Expected the cautious strategy");
    return Array.from(
      { length: 1000 },
      (_, index) => playProgram(real, strategy, index + 1, 20).turns,
    );
  })();

  it("makes cautious play slow but safe: rarely cancelled", () => {
    expect(cautious.cancelled).toBeLessThan(0.15);
  });

  it("makes bold play fast but risky: often cancelled, and much further ahead when it isn't", () => {
    expect(bold.cancelled).toBeGreaterThan(0.4);
    expect(bold.cancelled).toBeLessThan(0.6);
    const survivingScience = (plays: TurnRecord[][]) =>
      meanOf(plays.filter((play) => !cancelled(play)).map(scienceAtEnd));
    expect(survivingScience(bold.plays)).toBeGreaterThan(
      1.2 * survivingScience(cautious.plays),
    );
  });

  it("lets a cautious Program recover from a failed first Mission, which base funding pays to retry", () => {
    const failed = firstMissionFailed(cautiousOnRealFiles);
    expect(failed.length).toBeGreaterThan(20);
    expect(failed.filter(cancelled).length / failed.length).toBeLessThan(0.3);
  });

  it("still cancels a Program that launches nothing, as base funding alone never keeps Public Support up", () => {
    expect(played("launch nothing").cancelled).toBe(1);
  });
});
