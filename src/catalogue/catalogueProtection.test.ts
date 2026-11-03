import { describe, expect, it } from "vitest";
import { parseCatalogue, type CatalogueFiles } from "./catalogue";
import { errorFrom } from "./errorFrom";
import { testCatalogueFiles } from "../simulation/testCatalogue";
import { realCatalogueFiles } from "../testing/realCatalogue";

type ProtectionLevel = CatalogueFiles["crew"]["protection"][number];

/** The Test Catalogue with these Protection levels. */
function withProtection(protection: unknown[]): unknown {
  const files = testCatalogueFiles();
  return { ...files, crew: { ...files.crew, protection } };
}

/** The Test Catalogue with these changes to the Health a solar particle event costs Crew. */
function withParticleHarm(
  changes: Partial<CatalogueFiles["crew"]["health"]["solarParticleEvent"]>,
): unknown {
  const files = testCatalogueFiles();
  const { health } = files.crew;
  return {
    ...files,
    crew: {
      ...files.crew,
      health: {
        ...health,
        solarParticleEvent: { ...health.solarParticleEvent, ...changes },
      },
    },
  };
}

const levels = (): ProtectionLevel[] => testCatalogueFiles().crew.protection;

describe("Protection in the real data files", () => {
  const { crew, launchVehicles } = parseCatalogue(realCatalogueFiles());

  it("offers more than one level, starting with none", () => {
    expect(crew.protection.length).toBeGreaterThan(1);
    expect(crew.protection[0]).toMatchObject({
      massTonnes: 0,
      costMillions: 0,
      radiationCutPercent: 0,
    });
  });

  it("lets the largest Crew carry the most Supplies and the most Protection on the Meridian Colossus", () => {
    const colossus = launchVehicles.find(
      ({ id }) => id === "meridian-colossus",
    );
    const largest = crew.sizes.at(-1)?.massTonnes ?? Infinity;
    const most = crew.protection.at(-1)?.massTonnes ?? Infinity;
    const leastSupplies = crew.supplies.options[0]?.massTonnes ?? Infinity;
    expect(largest + most + leastSupplies).toBeLessThanOrEqual(
      colossus?.capacityTonnes ?? 0,
    );
  });

  it("makes carrying on through a solar particle event risk far more Health than safe mode", () => {
    const { safeModeLoss, hitLoss } = crew.health.solarParticleEvent;
    expect(hitLoss).toBeGreaterThan(3 * safeModeLoss);
  });
});

describe("invalid Protection", () => {
  it("accepts the Test Catalogue's Protection", () => {
    expect(parseCatalogue(testCatalogueFiles()).crew.protection).toHaveLength(
      2,
    );
  });

  it("rejects a first level that gives some Protection, which a Crewed Mission has unless the player buys more", () => {
    const [, shielding] = levels();
    expect(errorFrom(withProtection([shielding]))).toContain(
      `crew.json: the first Protection level, "test-shielding", must slow radiation's harm by 0%, as a Crewed Mission has it unless the player buys more`,
    );
  });

  it("rejects a level that slows radiation's harm no more than the one before it", () => {
    const [none, shielding] = levels();
    if (!none || !shielding) throw new Error("No Protection");
    expect(
      errorFrom(
        withProtection([
          none,
          shielding,
          { ...shielding, id: "test-thin", radiationCutPercent: 50 },
        ]),
      ),
    ).toContain(
      `crew.json: the Protection level "test-thin" slows radiation's harm by no more than "test-shielding" before it. Levels go from least Protection to most`,
    );
  });

  it("rejects the same level listed twice", () => {
    const [none, shielding] = levels();
    if (!none || !shielding) throw new Error("No Protection");
    expect(
      errorFrom(
        withProtection([
          none,
          shielding,
          { ...shielding, radiationCutPercent: 75 },
        ]),
      ),
    ).toContain(
      `crew.json: the Protection level "test-shielding" is listed more than once`,
    );
  });

  it("rejects no levels, and a level that slows radiation's harm by more than all of it", () => {
    expect(errorFrom(withProtection([]))).toContain("crew.json: protection:");
    const [none, shielding] = levels();
    expect(
      errorFrom(
        withProtection([none, { ...shielding, radiationCutPercent: 101 }]),
      ),
    ).toContain("crew.json: protection.1.radiationCutPercent:");
  });

  it("rejects a solar particle event that costs less Health when it hits than in safe mode", () => {
    expect(
      errorFrom(withParticleHarm({ safeModeLoss: 41, hitLoss: 40 })),
    ).toContain(
      "crew.json: a solar particle event that hits costs 40 Health, which must be no less than the 41 that safe mode costs",
    );
  });

  it("rejects a solar particle event that hits for all of a Crew member's Health", () => {
    expect(errorFrom(withParticleHarm({ hitLoss: 100 }))).toContain(
      "crew.json: a solar particle event that hits costs 100 Health, which must be less than the 100 Crew start with",
    );
  });
});
