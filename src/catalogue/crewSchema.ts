import { z } from "zod";
import { id, money } from "./schemaFields";

/* What the Crewed Mission's data file must look like. */

export const crewSchema = z.strictObject({
  // The spacecraft that carries the Crew to Mars, and stays with them, in Mars orbit or at their Landing Site.
  vehicleName: z.string().min(1),
  // The Mission Events it brings to Mars orbit, as an Asset's do. The Crew arrive when the last of them succeeds.
  missionEvents: z.array(id).min(1),
  // The Mission Events it brings when the Crew land at a Landing Site instead. They land when the last succeeds.
  landingMissionEvents: z.array(id).min(1),
  // The Crew sizes on offer, smallest first: how many fly, and what the Crewed Mission costs and weighs with them.
  sizes: z
    .array(
      z.strictObject({
        crew: z.number().int().positive(),
        costMillions: money,
        massTonnes: z.number().positive(),
      }),
    )
    .min(1),
  // Each Crew member's Health as they launch, which is the most they can have.
  maxHealth: z.number().int().positive(),
  // How Crew lose Health. Radiation is a cause of its own, on the way to Mars and at Mars, which Protection slows.
  health: z.strictObject({
    // Health lost to radiation for each day on the way to Mars (or back), and for each day at Mars.
    radiationPerDay: z.strictObject({
      inFlight: z.number().nonnegative(),
      atMars: z.number().nonnegative(),
    }),
    // Health lost for each day at Mars to everything else that living there does to the body.
    timeAtMarsPerDay: z.number().nonnegative(),
    // Health each Crew member on board loses when a Contingency saves their Mission.
    contingencyRescueLoss: z.number().int().nonnegative(),
    // Carrying on through a dust storm at their Landing Site: each Crew member's chance of being hurt, and the Health
    // it costs them if they are.
    dustStorm: z.strictObject({
      chance: z.number().min(0).max(1),
      loss: z.number().int().nonnegative(),
    }),
    // Health lost for each day a Crew member has no Supplies left, on top of everything else.
    noSuppliesPerDay: z.number().nonnegative(),
    // Health each Crew member on board loses to a solar particle event on the way: in safe mode, and if they carry on
    // and the radiation hits. Protection slows both, as it does all radiation.
    solarParticleEvent: z.strictObject({
      safeModeLoss: z.number().int().nonnegative(),
      hitLoss: z.number().int().nonnegative(),
    }),
  }),
  // The Protection a Crewed Mission can carry, such as radiation shielding, least first, with what each costs and
  // weighs and by what share it slows the Health Crew lose to radiation, in flight and at Mars. The first, which must
  // give none, is what it carries unless the player picks another.
  protection: z
    .array(
      z.strictObject({
        id,
        name: z.string().min(1),
        massTonnes: z.number().nonnegative(),
        costMillions: money,
        radiationCutPercent: z.number().int().min(0).max(100),
      }),
    )
    .min(1),
  // What Crew use up each day to stay alive, from launch, wherever they are.
  supplies: z.strictObject({
    // The kilograms each Crew member uses a day, so a larger Crew uses them faster.
    usePerMemberPerDayKg: z.number().positive(),
    // The Supplies a Crewed Mission can carry, least first, with what each costs and weighs. The first is what it
    // carries unless the player picks another.
    options: z
      .array(
        z.strictObject({
          id,
          name: z.string().min(1),
          massTonnes: z.number().positive(),
          costMillions: money,
        }),
      )
      .min(1),
  }),
  // The Public Support lost for each Crew member lost, whatever the cause, on top of anything else that day costs.
  publicSupportLossPerMember: z.number().int().nonnegative(),
  // What a round trip adds to a Crewed Mission to Mars orbit: an Earth return stage, which waits with the Crew there
  // and brings them home on a later Turn, when the player chooses.
  roundTrip: z.strictObject({
    name: z.string().min(1),
    description: z.string().min(1),
    // What it adds to the Crewed Mission's cost and mass, whatever the Crew size.
    costMillions: money,
    massTonnes: z.number().positive(),
    // The day of the Turn the journey home leaves Mars, which its Mission Events count from.
    leavesMarsOnDay: z.number().int().nonnegative(),
    // The Mission Events of the journey home, each timed from leaving Mars. The Crew are home when the last succeeds.
    missionEvents: z.array(id).min(1),
    // What Crew who landed fly first, from their Landing Site to their Earth return stage in Mars orbit: Mars ascent and
    // the rendezvous, each timed from leaving Mars, and the ascent propellant, in whole kilograms, the ascent uses up
    // at their site. A fuel plant makes it there, as carrying it from Earth would weigh too much.
    ascent: z.strictObject({
      missionEvents: z.array(id).min(1),
      propellantKg: z.number().int().positive(),
    }),
  }),
  // A return vehicle: an Earth return stage that a later Mission flies to Mars orbit on its own, with or without Crew of
  // its own, to bring home Crew already at Mars, such as those who went one way. It waits there for them, and they
  // come home in it on a later Turn as round-trip Crew do.
  returnVehicle: z.strictObject({
    name: z.string().min(1),
    description: z.string().min(1),
    // What it adds to the Mission's cost and mass.
    costMillions: money,
    massTonnes: z.number().positive(),
    // How many Crew it has room to bring home.
    crewRoom: z.number().int().positive(),
    // The Mission Events that take it to Mars orbit, as an Asset's do. It arrives when the last of them succeeds.
    missionEvents: z.array(id).min(1),
  }),
  // The Public Support earned for each Crew member who comes home safe, however they come home.
  publicSupportPerMemberHome: z.number().int().nonnegative(),
  // What Crew in Mars orbit can do, which all of them there share. The first is what they do unless the player picks
  // another. A research Activity earns its rate for each Crew member doing it.
  orbitActivities: z.array(id).min(1),
  // What Crew at a Landing Site can do, which all of them at that site share, in the same way.
  surfaceActivities: z.array(id).min(1),
  // The names Crew are given, in order. A name is never given twice in a Program.
  names: z.array(z.string().min(1)).min(1),
});
