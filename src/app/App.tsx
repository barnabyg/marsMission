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
            action={{
              kind: "load",
              confirm: screen.automaticSave.kind === "program",
              onLoad: (program) => {
                setScreen(planningScreen(services, program));
              },
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
        lastTurn={screen.lastTurn}
        saved={screen.saved}
        saveStore={saveStore}
        onLoad={(loaded) => {
          setScreen(planningScreen(services, loaded));
        }}
        onSubmit={(plan: TurnPlan) => {
          setScreen({
            mode: "mission",
            program,
            plan,
            answers: {},
            progress: simulation.workOutTurn(program, plan),
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

  if (screen.mode === "mission") {
    const { progress } = screen;
    return (
      <MissionMode
        timeline={progress.timeline}
        decisionPoint={progress.decisionPoint}
        onAnswer={(decisionId, answer) => {
          const answers = { ...screen.answers, [decisionId]: answer };
          setScreen({
            ...screen,
            answers,
            progress: simulation.workOutTurn(
              screen.program,
              screen.plan,
              answers,
            ),
          });
        }}
        initialSpeed={missionSpeed}
        onSpeedChange={setMissionSpeed}
        onFinished={() => {
          // Mission Mode can't finish a Turn that still has a Decision Point to answer.
          if (progress.decisionPoint) return;
          const { result } = progress;
          // The player has now seen how the Turn ended, so a cancelled Program can't be reopened.
          if (simulation.readProgram(result.program).status.kind !== "active") {
            saveStore.clear("automatic");
          }
          setScreen({ mode: "turnSummary", result, lastTurn: screen.program });
        }}
      />
    );
  }

  const { result, lastTurn } = screen;
  return (
    <TurnSummaryScreen
      summary={result.summary}
      onContinue={() => {
        const { program } = result;
        const active = simulation.readProgram(program).status.kind === "active";
        setScreen(
          active
            ? planningScreen(services, program, lastTurn)
            : { mode: "programSummary", program },
        );
      }}
    />
  );
}
