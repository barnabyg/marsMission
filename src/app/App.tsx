import { useState } from "react";
import { MissionMode } from "../mission/MissionMode";
import { TurnSummaryScreen } from "../mission/TurnSummaryScreen";
import { PlanningMode } from "../planning/PlanningMode";
import { ProgramSummaryScreen } from "../planning/ProgramSummaryScreen";
import { OpeningScreen } from "../save/OpeningScreen";
import { decisionAdvice } from "../tutorial/tutorial";
import type { Program, TurnPlan } from "../simulation/simulation";
import {
  newProgramScreen,
  planningScreen,
  withTutorial,
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
        simulation={simulation}
        saveStore={saveStore}
        automaticSave={screen.automaticSave}
        onContinue={(program) => {
          setScreen(planningScreen(services, program));
        }}
        onStartNew={() => {
          setScreen(newProgramScreen(services));
        }}
        onLoad={(program) => {
          setScreen(planningScreen(services, program));
        }}
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
        lastPlan={screen.lastPlan}
        tutorialEnding={screen.tutorialEnding}
        saved={screen.saved}
        firstSession={screen.firstSession}
        onTutorialChange={(on) => {
          setScreen(withTutorial(services, screen, on));
        }}
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
        onRestart={() => {
          // The new Program's automatic save replaces this one's.
          setScreen(newProgramScreen(services));
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
        decisionAdvice={
          progress.decisionPoint &&
          simulation.readProgram(screen.program).tutorial.kind === "on"
            ? decisionAdvice(
                progress.decisionPoint,
                simulation.readProgram(screen.program),
                screen.plan,
              )
            : null
        }
        tutorialOn={
          simulation.readProgram(screen.program).tutorial.kind === "on"
        }
        onTutorialOff={() => {
          // The Turn as worked out stays, Timeline and all, so that playback carries on where it is.
          const off = (program: Program) =>
            simulation.setTutorial(program, false);
          setScreen({
            ...screen,
            program: off(screen.program),
            progress: progress.decisionPoint
              ? progress
              : {
                  ...progress,
                  result: {
                    ...progress.result,
                    program: off(progress.result.program),
                  },
                },
          });
        }}
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
          setScreen({
            mode: "turnSummary",
            result,
            lastTurn: screen.program,
            lastPlan: screen.plan,
          });
        }}
      />
    );
  }

  const { result, lastTurn, lastPlan } = screen;
  return (
    <TurnSummaryScreen
      summary={result.summary}
      onContinue={() => {
        const { program } = result;
        const active = simulation.readProgram(program).status.kind === "active";
        setScreen(
          active
            ? planningScreen(services, program, {
                program: lastTurn,
                plan: lastPlan,
              })
            : { mode: "programSummary", program },
        );
      }}
    />
  );
}
