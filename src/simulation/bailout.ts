import type { Catalogue } from "../catalogue/catalogue";
import { checkCrew } from "./crew";
import type { MissionOutcome } from "./flight";
import { checkReturnVehicle } from "./returnVehicles";
import { sum, type Rules } from "./rules";
import { costOf } from "./technologyReadiness";
import type { Program, TurnPlan } from "./types";

/**
 * The Bailout: once in a Program, the player can have the cost of a lost Mission refunded, offered in the Turn summary
 * of the Turn it was lost, and repaid in equal instalments as each of the next Turns ends. Repayments are always taken,
 * so Money can go below zero, which stops the Program buying Missions and Developments until it recovers.
 */
export type Bailout =
  | { kind: "available" }
  /** A Mission was lost on the Turn just played, and taking the Bailout would refund this much. */
  | { kind: "offered"; millions: number }
  | {
      kind: "taken";
      /** The Turn whose lost Mission it refunded. */
      onTurn: number;
      millions: number;
      /** What is still to be repaid, one instalment for each Turn to come, the next one first. */
      repaymentsMillions: number[];
    };

/** What the player sees of the Bailout between Turns. */
export type BailoutView =
  | { kind: "unavailable" }
  | { kind: "available"; repaymentTurns: number }
  | {
      kind: "offered";
      millions: number;
      repaymentMillions: number;
      repaymentTurns: number;
    }
  | {
      kind: "taken";
      onTurn: number;
      millions: number;
      /** What this Turn's end takes, which is 0 once it is repaid. */
      dueThisTurnMillions: number;
      owedMillions: number;
      turnsLeft: number;
    };

/** The instalments that repay a Bailout of this much: equal whole millions, with what is left over in the last. */
function repaymentsFor(millions: number, turns: number): number[] {
  const each = Math.floor(millions / turns);
  return Array.from({ length: turns }, (_, index) =>
    index === turns - 1 ? millions - each * (turns - 1) : each,
  );
}

/** What is still owed on the Bailout, which is 0 unless it has been taken. */
export function bailoutOwed(bailout: Bailout): number {
  return bailout.kind === "taken" ? sum(bailout.repaymentsMillions) : 0;
}

/** What the Bailout takes as this Turn ends. */
export function bailoutRepayment(bailout: Bailout): number {
  return bailout.kind === "taken" ? (bailout.repaymentsMillions[0] ?? 0) : 0;
}

/**
 * What the Bailout would refund for the Turn's Mission, which is 0 unless it was lost. With nothing delivered, that is
 * all it cost. Otherwise it is only what was lost: each Asset with its Service Life and Reliability, the Crewed Mission
 * and a return vehicle, as the Launch Vehicle, Trajectory and Mission Events still delivered something. A Free-return's
 * refund comes off.
 */
export function bailoutRefund(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
  plan: TurnPlan,
  missionMillions: number,
  flown: MissionOutcome,
): number {
  const { mission } = plan;
  const lost = flown.failedEvent !== undefined || flown.lostTo !== null;
  if (!mission || !lost) return 0;
  const delivered =
    flown.deliveredAssets.length > 0 ||
    flown.deliveredCrew.length > 0 ||
    flown.returnVehicle?.delivered === true;
  const freeReturnRefund = flown.returned?.refundMillions ?? 0;
  if (!delivered) return Math.max(missionMillions - freeReturnRefund, 0);
  const assetsLost = flown.assets.filter(
    (asset) => !flown.deliveredAssets.includes(asset),
  );
  const crewLost =
    mission.crew !== undefined && flown.deliveredCrew.length === 0;
  const vehicleLost =
    flown.returnVehicle !== null && !flown.returnVehicle.delivered;
  const lostMillions =
    sum(
      assetsLost.map(
        (asset) =>
          costOf(program, asset) +
          rules.serviceLifeFor(mission, asset).costMillions +
          rules.assetReliabilityFor(mission, asset).costMillions,
      ),
    ) +
    (crewLost
      ? checkCrew(catalogue, rules, program, mission).costMillions
      : 0) +
    (vehicleLost
      ? checkReturnVehicle(catalogue, rules, program, mission).costMillions
      : 0);
  return Math.max(lostMillions - freeReturnRefund, 0);
}

/**
 * The Bailout once a Turn is over: one repayment fewer if it was taken, and otherwise offered if the Turn's Mission was
 * lost and the Program carries on, or available again if an offer wasn't taken.
 */
export function bailoutAfterTurn(
  catalogue: Catalogue,
  bailout: Bailout,
  refundMillions: number,
  cancelled: boolean,
): Bailout {
  if (bailout.kind === "taken") {
    return {
      ...bailout,
      repaymentsMillions: bailout.repaymentsMillions.slice(1),
    };
  }
  return catalogue.program.bailout && refundMillions > 0 && !cancelled
    ? { kind: "offered", millions: refundMillions }
    : { kind: "available" };
}

/** The Program with the Bailout taken: the refund paid now, and its repayments to come. Throws unless it is offered. */
export function takeBailout(catalogue: Catalogue, program: Program): Program {
  const { bailout } = program;
  const terms = catalogue.program.bailout;
  if (program.status.kind !== "active") {
    throw new Error("This Program has ended.");
  }
  if (bailout.kind !== "offered" || !terms) {
    throw new Error("The Bailout isn't on offer.");
  }
  return {
    ...program,
    moneyMillions: program.moneyMillions + bailout.millions,
    bailout: {
      kind: "taken",
      onTurn: program.turnNumber - 1,
      millions: bailout.millions,
      repaymentsMillions: repaymentsFor(bailout.millions, terms.repaymentTurns),
    },
  };
}

export function bailoutView(
  catalogue: Catalogue,
  bailout: Bailout,
): BailoutView {
  const terms = catalogue.program.bailout;
  if (bailout.kind === "taken") {
    return {
      kind: "taken",
      onTurn: bailout.onTurn,
      millions: bailout.millions,
      dueThisTurnMillions: bailoutRepayment(bailout),
      owedMillions: bailoutOwed(bailout),
      turnsLeft: bailout.repaymentsMillions.length,
    };
  }
  if (!terms) return { kind: "unavailable" };
  const repaymentTurns = terms.repaymentTurns;
  return bailout.kind === "offered"
    ? {
        kind: "offered",
        millions: bailout.millions,
        repaymentMillions:
          repaymentsFor(bailout.millions, repaymentTurns)[0] ?? 0,
        repaymentTurns,
      }
    : { kind: "available", repaymentTurns };
}
