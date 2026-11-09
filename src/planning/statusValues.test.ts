import { describe, expect, it } from "vitest";
import {
  changesSinceLastTurn,
  moneyDetail,
  publicSupportGauge,
  turnSpend,
} from "./statusValues";

describe("the Public Support gauge", () => {
  it("warns when Public Support is under one and a half times the Cancellation Level", () => {
    expect(publicSupportGauge(74, 50).warning).toBe(true);
  });

  it("doesn't warn from one and a half times the Cancellation Level up", () => {
    expect(publicSupportGauge(75, 50).warning).toBe(false);
  });

  it("runs up to three times the Cancellation Level while Public Support is below that", () => {
    const gauge = publicSupportGauge(75, 50);
    expect(gauge.fillPercent).toBeCloseTo(50);
    expect(gauge.levelPercent).toBeCloseTo(33.33);
  });

  it("runs up to Public Support once it is higher, so the bar is full", () => {
    const gauge = publicSupportGauge(600, 50);
    expect(gauge.fillPercent).toBe(100);
    expect(gauge.levelPercent).toBeCloseTo(8.33);
  });
});

describe("what this Turn will spend, under the Money", () => {
  it("says what it spends, with a minus sign, and what it leaves", () => {
    expect(turnSpend(1400, 2300)).toEqual({
      spent: "−$1.4B",
      rest: "$900M left",
      level: "within",
    });
  });

  it("spends $0M with no sign when nothing is chosen", () => {
    expect(turnSpend(0, 2300).spent).toBe("$0M");
  });

  it("says by how much it is over the Money", () => {
    expect(turnSpend(2350, 2300)).toMatchObject({
      rest: "$50M over",
      level: "over",
    });
  });

  it("rounds what it leaves to three significant figures", () => {
    expect(turnSpend(85, 9000).rest).toBe("$8.92B left");
  });
});

describe("the Money's tooltip", () => {
  it("says what Base funding comes in as the Turn ends", () => {
    expect(moneyDetail(2300, 200)).toBe("+$200M comes in as this Turn ends.");
  });

  it("adds the exact figure when the Money is rounded", () => {
    expect(moneyDetail(8915, 200)).toBe(
      "+$200M comes in as this Turn ends. Exactly $8.915B.",
    );
  });
});

const turnOne = {
  moneyMillions: 2300,
  publicSupport: 100,
  science: 0,
  cancellationLevel: 50,
};

describe("changes since the last Turn", () => {
  it("are none on the first Turn, which has no last Turn", () => {
    expect(changesSinceLastTurn(null, turnOne)).toEqual({});
  });

  it("are given for each value that changed, and left out for the rest", () => {
    expect(
      changesSinceLastTurn(turnOne, {
        moneyMillions: 2050,
        publicSupport: 255,
        science: 40,
        cancellationLevel: 50,
      }),
    ).toEqual({ moneyMillions: -250, publicSupport: 155, science: 40 });
  });
});
