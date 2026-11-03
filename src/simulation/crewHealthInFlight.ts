import { crewDeliveryDayOf, type Flight } from "./flight";
import { crewLoss } from "./lostCrew";
import { diedWithoutSupplies } from "./supplies";

/**
 * Works out what the flight did to the Health and Supplies of each Crew member it carried who wasn't lost with the
 * Mission, once it has flown: up to the day they arrived, got home on a Free-return, or reached a Decision Point with no
 * answer yet. Those whose Health ran out on the way are lost then, so they neither arrive nor come home: to their
 * Supplies if those had run out first, and otherwise to their Health.
 */
export function endCrewFlight(flight: Flight): void {
  const { catalogue, rules, mission, outcome } = flight;
  const lostWithMission = new Set(
    outcome.crewLost.flatMap(({ names }) => names),
  );
  // Crew delivered before a later failure, or still on board at a Decision Point, stop there.
  const stoppedOn = Math.min(
    crewDeliveryDayOf(rules, { mission }, outcome),
    outcome.failedOnDay ?? Infinity,
    outcome.decisionPoint?.day ?? Infinity,
  );
  const flown = flight.crew
    .filter((name) => !lostWithMission.has(name))
    .map((name) => {
      const homeward =
        outcome.returned !== null && !outcome.deliveredCrew.includes(name);
      return {
        name,
        homeward,
        ...flight.healthInFlight(
          name,
          homeward && outcome.returned ? outcome.returned.backOnDay : stoppedOn,
        ),
      };
    });
  outcome.crewHealth = flown.map(({ name, health, lost }) => ({
    name,
    health,
    lost,
  }));
  const flightEnds = outcome.returned?.backOnDay ?? stoppedOn;
  const outages = flight.suppliesOutages();
  if (flown.length > 0) {
    outcome.crewSuppliesKg = flight.suppliesLeftOn(flightEnds);
    const ranOut = outages.find(({ fromDay }) => fromDay < flightEnds);
    if (ranOut) {
      outcome.crewSuppliesOutOn = ranOut.fromDay;
      outcome.entries.push({
        kind: "suppliesOut",
        day: ranOut.fromDay,
        title: `Supplies out aboard the ${catalogue.crew.vehicleName}`,
        description: `The Crew aboard the ${catalogue.crew.vehicleName} have run out of Supplies, so their Health falls quickly.`,
      });
    }
  }
  const died = flown.flatMap(({ name, homeward, diedOn }) =>
    diedOn === null
      ? []
      : [
          {
            name,
            homeward,
            diedOn,
            starved: diedWithoutSupplies(outages, diedOn),
          },
        ],
  );
  const diedNames = new Set(died.map(({ name }) => name));
  outcome.deliveredCrew = outcome.deliveredCrew.filter(
    (name) => !diedNames.has(name),
  );
  const days = [...new Set(died.map(({ diedOn }) => diedOn))];
  for (const day of days.toSorted((first, second) => first - second)) {
    for (const homeward of [false, true]) {
      for (const starved of [false, true]) {
        outcome.crewLost.push(
          ...crewLoss(
            died
              .filter(
                (member) =>
                  member.diedOn === day &&
                  member.homeward === homeward &&
                  member.starved === starved,
              )
              .map(({ name }) => name),
            day,
            starved ? "supplies" : "health",
            `on the way ${homeward ? "home" : "to Mars"}, ${starved ? "with no Supplies left" : "when their Health ran out"}`,
          ),
        );
      }
    }
  }
}
