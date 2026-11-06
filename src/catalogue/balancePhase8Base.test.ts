import { describe, expect, it } from "vitest";
import { played } from "../testing/playedStrategies";

describe("the balance of a base at Mars, since Phase 8", () => {
  const landing = played(
    "big Program: develop the Meridian Colossus and land Crew when rich",
  );
  const besideHabitat = played("big Program: land Crew beside a habitat");
  const baseHome = played(
    "big Program: build a base, land Crew there and bring them home",
  );
  const noHabitat = played(
    "big Program: build a base with no habitat, land Crew there and bring them home",
  );
  const noLab = played(
    "big Program: build a base with no Mars lab, land Crew there and bring them home",
  );
  const robotic = played("big Program: one Asset per Mission");
  const labBesideRovers = played("big Program: land a Mars lab beside rovers");
  const oneSite = played("big Program: keep rovers at one Landing Site");
  const researchBase = played("big Program: build a research base");

  it("makes the habitat worth building in some strategies, without being an obvious yes", () => {
    // One-way Crew who land beside one last longer at their research.
    expect(besideHabitat.science).toBeGreaterThan(1.05 * landing.science);
    // Crew who come home before their Health runs low gain little from it.
    expect(baseHome.science).toBeLessThan(1.05 * noHabitat.science);
  });

  it("makes the Mars lab worth building in some strategies, without being an obvious yes", () => {
    // Beside the rovers kept at one Landing Site, or the Crew at a base, its Research Grants pay for it many times.
    expect(researchBase.money).toBeGreaterThan(1.3 * oneSite.money);
    expect(baseHome.science).toBeGreaterThan(1.2 * noLab.science);
    expect(baseHome.money).toBeGreaterThan(noLab.money);
    // Landed wherever its Benefit tag says it would add money, it takes the place of rovers that would earn Science.
    expect(labBesideRovers.science).toBeLessThan(0.85 * robotic.science);
  });
});
