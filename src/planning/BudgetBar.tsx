import type { ReactNode } from "react";
import { formatMoney } from "../simulation/simulation";
import { GameText } from "../ui/GameText";
import { Icon, type IconName } from "../ui/Icon";
import { budgetGauge } from "./budgetGauge";

interface BudgetBarProps {
  costMillions: number;
  /** What the Developments starting this Turn cost, which comes out of the same Money. */
  developmentCostMillions: number;
  /** What keeping the Assets at Mars going costs this Turn, which comes out of the same Money. */
  upkeepMillions: number;
  moneyMillions: number;
  massTonnes: number;
  capacityTonnes: number;
  /** What stops the Mission launching, which disables Launch Mission and shows on hovering over it. */
  launchProblems: string[];
  /** What stops the Turn ending without launching, likewise. */
  withoutLaunchingProblems: string[];
  /** Lines shown above the gauges, such as the Mission's problems. */
  children: ReactNode;
  onLaunch: () => void;
  onEndWithoutLaunching: () => void;
}

/**
 * The foot of the New Mission panel, always in view: the Mission's cost against the Money and its mass against the
 * Launch Vehicle's capacity, each as a filling bar that turns amber near its limit and red over it, and the buttons
 * that end the Turn.
 */
export function BudgetBar({
  costMillions,
  developmentCostMillions,
  upkeepMillions,
  moneyMillions,
  massTonnes,
  capacityTonnes,
  launchProblems,
  withoutLaunchingProblems,
  children,
  onLaunch,
  onEndWithoutLaunching,
}: BudgetBarProps) {
  const totalMillions = costMillions + developmentCostMillions + upkeepMillions;
  return (
    <div className="budget-bar" data-testid="budget-bar">
      {children}
      <div className="budget-bar-row">
        <BudgetGauge
          testId="cost-gauge"
          icon="coins"
          name="Mission cost against Money"
          used={totalMillions}
          limit={moneyMillions}
        >
          <GameText>Mission cost</GameText>{" "}
          <strong data-testid="mission-cost">
            {formatMoney(costMillions)}
          </strong>
          {developmentCostMillions > 0 && (
            <>
              {" + "}
              <GameText>Development</GameText>{" "}
              <strong data-testid="development-cost">
                {formatMoney(developmentCostMillions)}
              </strong>
            </>
          )}
          {upkeepMillions > 0 && (
            <>
              {" + "}
              <GameText>Upkeep</GameText>{" "}
              <strong data-testid="upkeep-cost">
                {formatMoney(upkeepMillions)}
              </strong>
            </>
          )}{" "}
          of {formatMoney(moneyMillions)}
        </BudgetGauge>
        <BudgetGauge
          testId="mass-gauge"
          icon="weight"
          name="Mission mass against Launch Vehicle capacity"
          used={massTonnes}
          limit={capacityTonnes}
        >
          Mass{" "}
          <strong data-testid="mission-mass">
            {massTonnes} of {capacityTonnes} tonnes
          </strong>
        </BudgetGauge>
        <div className="mission-buttons">
          <button
            type="button"
            className="primary"
            disabled={launchProblems.length > 0}
            // A disabled button says why on hover, as Mission Mode's End Turn says what it does.
            title={launchProblems.join(" ") || undefined}
            onClick={onLaunch}
          >
            Launch Mission
          </button>
          <button
            type="button"
            disabled={withoutLaunchingProblems.length > 0}
            title={withoutLaunchingProblems.join(" ") || undefined}
            onClick={onEndWithoutLaunching}
          >
            End Turn without launching
          </button>
        </div>
      </div>
    </div>
  );
}

/** One budget as a caption over a bar that fills towards its limit. */
function BudgetGauge({
  testId,
  icon,
  name,
  used,
  limit,
  children,
}: {
  testId: string;
  icon: IconName;
  /** What the bar measures, for a screen reader. */
  name: string;
  used: number;
  limit: number;
  children: ReactNode;
}) {
  const { fillPercent, level } = budgetGauge(used, limit);
  return (
    <div
      className={`budget-gauge ${level}`}
      data-testid={testId}
      data-level={level}
    >
      <span className="budget-gauge-caption">
        <Icon name={level === "within" ? icon : "alert-triangle"} />
        <span>{children}</span>
      </span>
      <span
        className="gauge-track"
        role="meter"
        aria-label={name}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={used}
      >
        <span
          className="gauge-fill"
          style={{ width: `${String(fillPercent)}%` }}
        />
      </span>
    </div>
  );
}
