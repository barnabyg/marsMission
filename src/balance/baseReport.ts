import { formatMoney, formatPropellant } from "../simulation/simulation";
import type { TurnRecord } from "./playProgram";

type Play = TurnRecord[];

// The lines of a strategy's section on what a base at Mars did and what came home, each left out with none.

/** The ascent propellant made and used per Program, or nothing for a strategy that never lands a fuel plant. */
function ascentPropellant(plays: Play[]): string[] {
  const madeKg = plays
    .flat()
    .reduce((total, { ascentPropellantKg }) => total + ascentPropellantKg, 0);
  const usedKg = plays
    .flat()
    .reduce(
      (total, { ascentPropellantUsedKg }) => total + ascentPropellantUsedKg,
      0,
    );
  // Left out with none, so that strategies that never land a fuel plant report as they did before fuel plants, and
  // those whose Crew never leave the surface as they did before Mars ascent.
  return madeKg > 0
    ? [
        `Ascent propellant per Program made by fuel plants: ${formatPropellant(madeKg / plays.length)}${
          usedKg > 0
            ? `, of which Mars ascent used ${formatPropellant(usedKg / plays.length)}`
            : ""
        }`,
      ]
    : [];
}

/** The Health habitats saved per Program, or nothing for a strategy that never lands Crew beside one. */
function healthSavedByHabitats(plays: Play[]): string[] {
  const saved = plays
    .flat()
    .reduce((total, { healthSavedByHabitats: each }) => total + each, 0);
  // Left out with none, so that strategies that never land a habitat report as they did before habitats.
  return saved > 0
    ? [
        `Health per Program that habitats saved Crew: ${(saved / plays.length).toFixed(1)}`,
      ]
    : [];
}

/** The samples that reached Earth per Program, and the Science they earned, or nothing for a strategy that returns none. */
function samplesReturned(plays: Play[]): string[] {
  const records = plays.flat();
  const samples = records.reduce(
    (total, { samplesHome }) => total + samplesHome,
    0,
  );
  const science = records.reduce(
    (total, { sampleScience }) => total + sampleScience,
    0,
  );
  // Left out with none, so that strategies that never return samples report as they did before samples.
  return samples > 0
    ? [
        `Samples per Program that reached Earth: ${(samples / plays.length).toFixed(1)}, earning ${Math.round(science / plays.length)} Science`,
      ]
    : [];
}

/** What Mars labs added to Research Grants per Program, or nothing for a strategy that never lands one beside them. */
function grantsAddedByLabs(plays: Play[]): string[] {
  const added = plays
    .flat()
    .reduce(
      (total, { grantsAddedByLabsMillions }) =>
        total + grantsAddedByLabsMillions,
      0,
    );
  // Left out with none, so that strategies that never land a Mars lab report as they did before Mars labs.
  return added > 0
    ? [
        `Research Grants per Program that Mars labs added: ${formatMoney(Math.round(added / plays.length))}`,
      ]
    : [];
}

/** Every line on a base and coming home for a strategy's section. */
export function baseLines(plays: Play[]): string[] {
  return [
    ...ascentPropellant(plays),
    ...healthSavedByHabitats(plays),
    ...grantsAddedByLabs(plays),
    ...samplesReturned(plays),
  ];
}
