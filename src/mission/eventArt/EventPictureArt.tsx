import type { ComponentType } from "react";
import type { EventPicture } from "./eventCard";
import {
  AssetEndedScene,
  CrewArrivedScene,
  CrewLostScene,
  DustStormScene,
  FirstLandingScene,
  FundingThresholdScene,
  MilestoneScene,
  SuppliesOutScene,
} from "./groundScenes";
import {
  AssetFailedScene,
  EntryDescentLandingScene,
  FlightProvenScene,
  LaunchScene,
  MissionReturnedScene,
  OrbitInsertionScene,
  RendezvousScene,
  SolarParticleEventScene,
  SpacecraftScene,
  SurveyScene,
  TankerLaunchScene,
  TransferBurnScene,
} from "./spaceScenes";

const scenes: Record<EventPicture, ComponentType> = {
  launch: LaunchScene,
  tankerLaunch: TankerLaunchScene,
  rendezvous: RendezvousScene,
  transferBurn: TransferBurnScene,
  orbitInsertion: OrbitInsertionScene,
  entryDescentLanding: EntryDescentLandingScene,
  spacecraft: SpacecraftScene,
  missionReturned: MissionReturnedScene,
  dustStorm: DustStormScene,
  solarParticleEvent: SolarParticleEventScene,
  milestone: MilestoneScene,
  fundingThreshold: FundingThresholdScene,
  firstLanding: FirstLandingScene,
  survey: SurveyScene,
  flightProven: FlightProvenScene,
  crewArrived: CrewArrivedScene,
  crewLost: CrewLostScene,
  suppliesOut: SuppliesOutScene,
  assetEnded: AssetEndedScene,
  assetFailed: AssetFailedScene,
};

/** Draws one of the events column's pictures. */
export function EventPictureArt({ picture }: { picture: EventPicture }) {
  const SceneArt = scenes[picture];
  return <SceneArt />;
}
