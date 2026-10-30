import { useState } from "react";
import { MissionMode } from "../mission/MissionMode";
import { TurnSummaryScreen } from "../mission/TurnSummaryScreen";
import { PlanningMode } from "../planning/PlanningMode";
import { ProgramSummaryScreen } from "../planning/ProgramSummaryScreen";
import { OpeningScreen } from "../save/OpeningScreen";
import { SaveSlots } from "../save/SaveSlots";
import type { TurnPlan } from "../simulation/simulation";
import {
  newProgramScreen,
  planningScreen,
  type GameServices,
  type Screen,
} from "./screens";

interface AppProps {
  services: GameServices;
  firstScreen: Screen;
}

export function App({ services, firstScreen }: AppProps) {
  const { simulation, saveStore } = services;
  const [screen, setScreen] = useState(firstScreen);
  const [missionSpeed, setMissionSpeed] = useState(1);

  if (screen.mode === "opening") {
    return (
      <OpeningScreen
        automaticSave={screen.automaticSave}
        onContinue={(program) => {
          setScreen(planningScreen(services, program));
        }}
        onStartNew={() => {
          setScreen(newProgramScreen(services));
        }}
        saveSlots={
          <SaveSlots
            simulation={simulation}
            saveStore={saveStore}
            program={null}
            confirmLoading={screen.automaticSave.kind === "program"}
            onLoad={(program) => {
              setScreen(planningScreen(services, program));
            }}
          />
        }
      />
    );
  }

  if (screen.mode === "planning") {
    const { program } = screen;
    return (
      <PlanningMode
        key={screen.visit}
        simulation={simulation}
        program={program}
        saved={screen.saved}
        saveSlots={
          <SaveSlots
            simulation={simulation}
            saveStore={saveStore}
            program={program}
            confirmLoading
            onLoad={(loaded) => {
              setScreen(planningScreen(services, loaded));
            }}
          />
        }
        onSubmit={(plan: TurnPlan) => {
          setScreen({
            mode: "mission",
            result: simulation.runTurn(program, plan),
          });
        }}
        onRetire={() => {
          saveStore.clear("automatic");
          setScreen({
            mode: "programSummary",
            program: simulation.retireProgram(program),
          });
        }}
      />
    );
  }

  if (screen.mode === "programSummary") {
    return (
      <ProgramSummaryScreen
        view={simulation.readProgram(screen.program)}
        onStartNew={() => {
          setScreen(newProgramScreen(services));
        }}
      />
    );
  }

  const { result } = screen;
  if (screen.mode === "mission") {
    return (
      <MissionMode
        timeline={result.timeline}
        initialSpeed={missionSpeed}
        onSpeedChange={setMissionSpeed}
        onFinished={() => {
          // The player has now seen how the Turn ended, so a cancelled Program can't be reopened.
          if (simulation.readProgram(result.program).status.kind !== "active") {
            saveStore.clear("automatic");
          }
          setScreen({ mode: "turnSummary", result });
        }}
      />
    );
  }

  return (
    <TurnSummaryScreen
      summary={result.summary}
      onContinue={() => {
        const { program } = result;
        const active = simulation.readProgram(program).status.kind === "active";
        setScreen(
          active
            ? planningScreen(services, program)
            : { mode: "programSummary", program },
        );
      }}
    />
  );
}
