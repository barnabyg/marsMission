import { describe, expect, it } from "vitest";
import { parseCatalogue, type Catalogue } from "../catalogue/catalogue";
import { startFlight } from "./flight";
import { createRules } from "./rules";
import { createSimulation, type Program } from "./simulation";
import { testCatalogueFiles } from "./testCatalogue";
import { sendLander, skipTurn } from "./testHelpers";

/** The test catalogue with two Mission Events timed from leaving Mars, which nothing flying to Mars brings. */
function withJourneyHomeEvents() {
  const files = testCatalogueFiles();
  const catalogue = parseCatalogue({
    ...files,
    missionEvents: [
      ...files.missionEvents,
      {
        id: "test-trans-earth-injection",
        name: "Test trans-Earth injection",
        description: "Leaves Mars orbit for home.",
        failureDescription: "The engine cut out.",
        timing: { from: "leavingMars", days: 0 },
        failureProbability: 0,
        publicSupportLoss: 30,
      },
      {
        id: "test-earth-entry",
        name: "Test Earth entry",
        description: "Splashes down.",
        failureDescription: "The heat shield failed.",
        timing: { from: "leavingMars", days: 180 },
        failureProbability: 0,
        publicSupportLoss: 30,
      },
    ],
  });
  const rules = createRules(catalogue);
  const eventById = (eventId: string) => {
    const event = catalogue.missionEvents.find(({ id }) => id === eventId);
    if (!event) throw new Error(`No Mission Event "${eventId}"`);
    return event;
  };
  return { catalogue, rules, eventById };
}

describe("Mission Events timed from leaving Mars", () => {
  it("happen that many days after the Turn's journey home leaves Mars", () => {
    const { catalogue, rules, eventById } = withJourneyHomeEvents();
    const flight = startFlight(
      catalogue,
      rules,
      programFor(catalogue),
      skipTurn,
      {},
      40,
    );
    expect(flight.leavesMarsOn).toBe(40);
    expect(flight.dayOf(eventById("test-trans-earth-injection"))).toBe(40);
    expect(flight.dayOf(eventById("test-earth-entry"))).toBe(220);
  });

  it("aren't moved by a landing held off for a dust storm, which only delays the Mission to Mars", () => {
    const { catalogue, rules, eventById } = withJourneyHomeEvents();
    const flight = startFlight(
      catalogue,
      rules,
      programFor(catalogue),
      sendLander,
      {},
      40,
    );
    flight.daysHeld = 10;
    expect(flight.dayOf(eventById("test-earth-entry"))).toBe(220);
    expect(flight.dayOf(eventById("test-landing"))).toBe(
      rules.dayOf(eventById("test-landing"), sendLander.mission) + 10,
    );
  });

  it("have no day in a Turn with no journey home, which is every Turn so far", () => {
    const { catalogue, rules, eventById } = withJourneyHomeEvents();
    const flight = startFlight(
      catalogue,
      rules,
      programFor(catalogue),
      sendLander,
      {},
    );
    expect(flight.leavesMarsOn).toBeNull();
    expect(() => flight.dayOf(eventById("test-earth-entry"))).toThrow(
      'The Mission Event "test-earth-entry" is timed from leaving Mars, but nothing leaves Mars this Turn',
    );
  });
});

/** A Program on its first Turn. */
function programFor(catalogue: Catalogue): Program {
  return createSimulation(catalogue).startProgram(42);
}
