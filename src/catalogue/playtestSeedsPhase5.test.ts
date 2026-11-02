import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseCatalogue } from "./catalogue";
import { createSimulation, type TurnPlan } from "../simulation/simulation";
import { realCatalogueFiles } from "../testing/realCatalogue";

// If tuning fails one of these, find a new seed that gives this story and update the guide.
describe("the known seeds in the Phase 5 playtest guide", () => {
  const guide = readFileSync("docs/playtest/phase-5.md", "utf8");
  const real = createSimulation(parseCatalogue(realCatalogueFiles()));
  const orbiting = {
    launchVehicleId: "meridian-medium",
    assetIds: ["pathfinder-orbiter"],
  };
  const orbiter: TurnPlan = { mission: orbiting };
  const lander: TurnPlan = {
    mission: {
      launchVehicleId: "meridian-medium",
      assetIds: ["prospector-lander"],
      landingSiteId: "jezero-crater",
    },
  };

  it("has a solar particle event, a go/no-go check and a dust storm on the first three Turns", () => {
    expect(guide).toContain("?seed=1236)");
    const start = real.startProgram(1236);

    const particles = real.workOutTurn(start, orbiter).decisionPoint;
    expect(particles?.kind).toBe("solarParticleEvent");
    expect(particles?.choices[1].riskBand).toBe("~20%");
    const first = real.runTurn(start, orbiter, {
      "solar-particle-event": "safeMode",
    });
    expect(first.summary).toMatchObject({
      moneyEndMillions: 2300,
      publicSupportEnd: 255,
      failure: null,
    });
    expect(real.readProgram(first.program).operatingAssets[0]?.daysLeft).toBe(
      535,
    );

    const check = real.workOutTurn(first.program, lander).decisionPoint;
    expect(check).toMatchObject({
      kind: "goNoGo",
      siteName: "Jezero Crater",
    });
    expect(check?.choices.map(({ riskBand }) => riskBand)).toEqual([
      "~20%",
      "~10%",
    ]);
    expect(check?.choices[1].description).toContain("Land in 114 days");
    expect(check?.choices[1].description).toContain("171 days");
    const second = real.runTurn(first.program, lander, {
      "go-no-go:entry-descent-landing": "holdOff",
    });
    expect(second.summary).toMatchObject({
      moneyEndMillions: 2729,
      publicSupportEnd: 434,
      failure: null,
      goNoGo: { daysHeld: 114, serviceLifeDaysLost: 171 },
    });
    expect(second.summary.ongoingResearch[0]?.days).toBe(451);
    expect(
      real.runTurn(first.program, lander, {
        "go-no-go:entry-descent-landing": "go",
      }).summary.ongoingResearch[0]?.days,
    ).toBe(565);

    const skip: TurnPlan = { mission: null };
    const storm = real.workOutTurn(second.program, skip).decisionPoint;
    expect(storm).toMatchObject({
      kind: "dustStorm",
      siteName: "Jezero Crater",
      assets: ["Prospector Lander"],
    });
    expect(storm?.description).toContain("211 days");
    expect(storm?.choices[0].description).toContain(
      "27 Science, 2 Public Support and $14M of Research Grants",
    );
    expect(storm?.choices[1].riskBand).toBe("~10%");
    const answered = (answer: "shelter" | "carryOn") =>
      real.runTurn(second.program, skip, {
        "dust-storm:jezero-crater": answer,
      }).summary;
    expect(answered("shelter").moneyEndMillions).toBe(2759);
    expect(answered("carryOn")).toMatchObject({
      moneyEndMillions: 2773,
      assetsFailed: [],
    });
  });

  it("has a Mars orbit insertion that Reserve fuel saves", () => {
    expect(guide).toContain("?seed=13)");
    const insured: TurnPlan = {
      mission: { ...orbiting, contingencyIds: ["reserve-fuel"] },
    };
    const start = real.startProgram(13);
    expect(real.workOutTurn(start, insured).decisionPoint?.id).toBe(
      "contingency:mars-orbit-insertion",
    );
    const { summary } = real.runTurn(start, insured, {
      "contingency:mars-orbit-insertion": "use",
    });
    expect(summary.contingencies[0]?.rescued).toBe(true);
    expect(summary.moneyEndMillions).toBe(2180);
  });

  it("has a Mars transfer burn that fails the day after launch", () => {
    expect(guide).toContain("?seed=2)");
    const progress = real.workOutTurn(real.startProgram(2), orbiter);
    expect(progress.decisionPoint).toBeNull();
    if (progress.decisionPoint) return;
    expect(progress.result.summary).toMatchObject({
      moneyEndMillions: 1300,
      publicSupportEnd: 68,
      failure: { missionEventName: "Mars transfer burn" },
    });
  });
});
