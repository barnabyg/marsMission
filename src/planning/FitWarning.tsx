import { GameText } from "../ui/GameText";
import { Icon } from "../ui/Icon";
import type { Fit } from "./missionFit";

/** What adding an Asset or Crew would take the Mission over, said before the player ticks it, or nothing if it fits. */
export function FitWarning({ fit }: { fit: Fit }) {
  const reasons = [
    ...(fit.overCapacity ? ["Too heavy for the Launch Vehicle"] : []),
    ...(fit.overMoney ? ["Costs more than the Money left"] : []),
  ];
  if (reasons.length === 0) return null;
  return (
    <p className="fit-warning" data-testid="fit-warning">
      <Icon name="alert-triangle" />
      <span>
        <GameText>{reasons.join(" · ")}</GameText>
      </span>
    </p>
  );
}
