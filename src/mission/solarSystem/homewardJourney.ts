import type { Homeward } from "../homeward";

/** The journey home on its way from Mars to Earth, as the solar system view shows it on a given day. */
export interface HomewardOnDay {
  /** The days it left Mars orbit and gets to Earth, which the path runs between. */
  fromDay: number;
  toDay: number;
  /** Whether it's on its way now, between leaving Mars orbit and Earth entry. */
  onItsWay: boolean;
  /** How far along it is, from 0 leaving Mars orbit to 1 at Earth. */
  progress: number;
  crewed: boolean;
  vehicleName: string;
}

/**
 * The journey home in the solar system on a given day, once it has left Mars orbit, with its path staying for the rest
 * of the Turn as the way out's does. Nothing shows if it never left: Mars ascent, the rendezvous or leaving orbit failed.
 */
export function homewardOnDay(
  homeward: Homeward | null,
  day: number,
): HomewardOnDay | null {
  const departure = homeward?.moments.departure;
  if (!homeward || !departure || departure.failed || day < departure.day) {
    return null;
  }
  const fromDay = departure.day;
  const toDay = homeward.moments.entry?.day ?? homeward.homeOnDay;
  return {
    fromDay,
    toDay,
    onItsWay: day < toDay,
    progress: Math.min((day - fromDay) / (toDay - fromDay), 1),
    crewed: homeward.aboard === "crew",
    vehicleName: homeward.vehicleName,
  };
}

/** What the player reads beside the journey home in the solar system. */
export function homewardLabel({
  crewed,
  vehicleName,
}: Pick<HomewardOnDay, "crewed" | "vehicleName">): string {
  return `${vehicleName}: ${crewed ? "Crew" : "samples"} heading home`;
}
