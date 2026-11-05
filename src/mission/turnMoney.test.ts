import { describe, expect, it } from "vitest";
import { turnMoney } from "./turnMoney";

describe("the Turn summary's Money", () => {
  it("splits what was spent from what was received", () => {
    expect(
      turnMoney({
        missionCostMillions: 500,
        developmentCostMillions: 300,
        upkeepMillions: 60,
        fundingPayouts: [
          { publicSupport: 300, payoutMillions: 1000 },
          { publicSupport: 600, payoutMillions: 500 },
        ],
        researchGrantMillions: 40,
        failure: null,
      }),
    ).toEqual({
      spent: [
        { name: "Mission cost", millions: 500 },
        { name: "Development", millions: 300 },
        { name: "Upkeep", millions: 60 },
      ],
      received: [
        { name: "Funding Thresholds", millions: 1500 },
        { name: "Research Grants", millions: 40 },
      ],
      changeMillions: 680,
    });
  });

  it("leaves out what came to nothing, such as a Turn with nothing launched", () => {
    expect(
      turnMoney({
        missionCostMillions: 0,
        developmentCostMillions: 0,
        upkeepMillions: 0,
        fundingPayouts: [],
        researchGrantMillions: 25,
        failure: null,
      }),
    ).toEqual({
      spent: [],
      received: [{ name: "Research Grants", millions: 25 }],
      changeMillions: 25,
    });
  });

  it("counts the refund from a Free-return as received, so the lines still add up", () => {
    expect(
      turnMoney({
        missionCostMillions: 1000,
        developmentCostMillions: 0,
        upkeepMillions: 0,
        fundingPayouts: [],
        researchGrantMillions: 0,
        failure: {
          missionEventName: "Arrival burn",
          assetsLost: ["Test orbiter"],
          publicSupportLost: 20,
          returnedToEarth: true,
          refundMillions: 400,
        },
      }),
    ).toEqual({
      spent: [{ name: "Mission cost", millions: 1000 }],
      received: [{ name: "Refund", millions: 400 }],
      changeMillions: -600,
    });
  });
});
