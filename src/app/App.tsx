import { useState } from "react";
import { MissionMode } from "../mission/MissionMode";
import { TurnSummaryScreen } from "../mission/TurnSummaryScreen";
import { PlanningMode } from "../planning/PlanningMode";
import type {
  Program,
  Simulation,
  TurnPlan,
  TurnResult,
} from "../simulation/simulation";

type Screen =
  | { mode: "planning"; program: Program }
  | { mode: "mission"; result: TurnResult }
  | { mode: "turnSummary"; result: TurnResult };

export function App({ simulation }: { simulation: Simulation }) {
  const [screen, setScreen] = useState<Screen>(() => ({
    mode: "planning",
    program: simulation.startProgram(Date.now()),
  }));

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
        setScreen({ mode: "planning", program: result.program });
      }}
    />
  );
}
