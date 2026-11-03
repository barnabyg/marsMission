import type { Flight } from "./flight";
import { crewLoss } from "./lostCrew";

/**
 * Works out what the flight did to the Health of each Crew member it carried who wasn't lost with the Mission, once it
 * has flown: up to the day they arrived, got home on a Free-return, or reached a Decision Point with no answer yet.
 * Those whose Health ran out on the way are lost then, so they neither arrive nor come home.
 */
export function endCrewFlight(flight: Flight): void {
  const { catalogue, rules, mission, outcome } = flight;
  const lostWithMission = new Set(
    outcome.crewLost.flatMap(({ names }) => names),
  );
  // Crew delivered before a later failure, or still on board at a Decision Point, stop there.
  const stoppedOn = Math.min(
    rules.deliveryDay(catalogue.crew, mission),
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
  const died = flown.filter(({ diedOn }) => diedOn !== null);
  const diedNames = new Set(died.map(({ name }) => name));
  outcome.deliveredCrew = outcome.deliveredCrew.filter(
    (name) => !diedNames.has(name),
  );
  const days = [...new Set(died.map(({ diedOn }) => diedOn ?? 0))];
  for (const day of days.toSorted((first, second) => first - second)) {
    for (const homeward of [false, true]) {
      outcome.crewLost.push(
        ...crewLoss(
          died
            .filter(
              (member) => member.diedOn === day && member.homeward === homeward,
            )
            .map(({ name }) => name),
          day,
          "health",
          `on the way ${homeward ? "home" : "to Mars"}, when their Health ran out`,
        ),
      );
    }
  }
}
