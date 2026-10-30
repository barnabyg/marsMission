import { useState } from "react";
import { MissionMode } from "../mission/MissionMode";
import { TurnSummaryScreen } from "../mission/TurnSummaryScreen";
import { PlanningMode } from "../planning/PlanningMode";
import { ProgramSummaryScreen } from "../planning/ProgramSummaryScreen";
import type {
  Program,
  Simulation,
  TurnPlan,
  TurnResult,
} from "../simulation/simulation";

type Screen =
  | { mode: "planning"; program: Program }
  | { mode: "mission"; result: TurnResult }
  | { mode: "turnSummary"; result: TurnResult }
  | { mode: "programSummary"; program: Program };

export function App({ simulation }: { simulation: Simulation }) {
  const newProgram = (): Screen => ({
    mode: "planning",
    program: simulation.startProgram(Date.now()),
  });
  const [screen, setScreen] = useState<Screen>(newProgram);

  if (screen.mode === "planning") {
    const { program } = screen;
    return (
      <PlanningMode
        simulation={simulation}
        program={program}
        onSubmit={(plan: TurnPlan) => {
          setScreen({
            mode: "mission",
            result: simulation.runTurn(program, plan),
          });
        }}
        onRetire={() => {
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
          setScreen(newProgram());
        }}
      />
    );
  }

  const { result } = screen;
  if (screen.mode === "mission") {
    return (
      <MissionMode
        timeline={result.timeline}
        onFinished={() => {
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
        setScreen({ mode: active ? "planning" : "programSummary", program });
      }}
    />
  );
}
