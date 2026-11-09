import type { CSSProperties, ReactNode } from "react";
import type { ProgramView } from "../simulation/simulation";
import {
  formatChange,
  formatLaunchWindow,
  formatRoundedMoney,
  toThreeFigures,
} from "../ui/format";
import { GameText } from "../ui/GameText";
import { Icon, type IconName } from "../ui/Icon";
import {
  changesSinceLastTurn,
  moneyDetail,
  publicSupportGauge,
  turnSpend,
} from "./statusValues";

interface StatusBarProps {
  view: ProgramView;
  /** What the player saw at the start of the last Turn, or null on the first Turn or after a Load, which show no changes. */
  lastTurn: ProgramView | null;
  /** What the choices made so far would spend this Turn, which the status bar shows under the Money. */
  spendMillions: number;
  /** The Program's own buttons, such as Save and Load, which sit under the heading so that they take no row of their own. */
  actions?: ReactNode;
}

/**
 * Planning Mode's header: where the Program stands, with how each value changed over the last Turn. Money is rounded to
 * three significant figures, with the exact figure in its tooltip.
 */
export function StatusBar({
  view,
  lastTurn,
  spendMillions,
  actions,
}: StatusBarProps) {
  const changes = changesSinceLastTurn(lastTurn, view);
  const threshold = view.nextFundingThreshold;

  return (
    <header className="status-bar">
      <div className="status-title">
        <h1>
          <GameText>Planning Mode</GameText>
        </h1>
        {actions}
      </div>
      <dl>
        <StatusValue icon="hourglass" term="Turn" testId="turn-number">
          {String(view.turnNumber)}
        </StatusValue>
        <StatusValue
          icon="calendar"
          term="Launch Window"
          testId="launch-window"
        >
          {formatLaunchWindow(view.date)}
        </StatusValue>
        <StatusValue
          icon="coins"
          term="Money"
          testId="money"
          change={changes.moneyMillions}
          unit="money"
          detail={moneyDetail(view.moneyMillions, view.baseFundingMillions)}
          caption={
            <TurnSpendLine
              spendMillions={spendMillions}
              moneyMillions={view.moneyMillions}
            />
          }
        >
          {formatRoundedMoney(view.moneyMillions)}
        </StatusValue>
        <SupportGauge
          view={view}
          supportChange={changes.publicSupport}
          levelChange={changes.cancellationLevel}
        />
        <StatusValue
          icon="target"
          term="Next Funding Threshold"
          testId="next-funding-threshold"
          caption={
            threshold && (
              <span data-testid="next-funding-threshold-away">
                {`${String(threshold.pointsAway)} away`}
              </span>
            )
          }
        >
          {threshold ? (
            <GameText>
              {`${formatRoundedMoney(threshold.payoutMillions)} at ${String(threshold.publicSupport)} Public Support`}
            </GameText>
          ) : (
            "None left"
          )}
        </StatusValue>
        <StatusValue
          icon="flask-conical"
          term="Science"
          testId="science"
          change={changes.science}
        >
          {String(view.science)}
        </StatusValue>
      </dl>
    </header>
  );
}

/** Public Support on a gauge, with the Cancellation Level as a tick on it, labelled under the tick. */
function SupportGauge({
  view,
  supportChange,
  levelChange,
}: {
  view: ProgramView;
  supportChange: number | undefined;
  levelChange: number | undefined;
}) {
  const gauge = publicSupportGauge(view.publicSupport, view.cancellationLevel);
  return (
    <div
      className={`support-gauge${gauge.warning ? " warning" : ""}`}
      data-testid="support-gauge"
    >
      <dt>
        <Icon name="users" />
        <GameText>Public Support</GameText>
      </dt>
      <dd>
        <span className="status-value">
          <span data-testid="public-support">{view.publicSupport}</span>
          <Change change={supportChange} testId="public-support-change" />
        </span>
        <span
          className="gauge"
          style={{ "--level": gauge.levelPercent / 100 } as CSSProperties}
        >
          <span className="gauge-track" aria-hidden="true">
            <span
              className="gauge-fill"
              style={{ width: `${String(gauge.fillPercent)}%` }}
            />
            <span className="gauge-level" />
          </span>
          <span className="gauge-label" data-testid="cancellation-label">
            {gauge.warning && <Icon name="alert-triangle" />}
            <GameText>Cancellation Level</GameText>{" "}
            <span data-testid="cancellation-level">
              {view.cancellationLevel}
            </span>
            <Change change={levelChange} testId="cancellation-level-change" />
          </span>
        </span>
      </dd>
    </div>
  );
}

/**
 * What this Turn will spend and what that leaves, as one muted line under the Money, turning amber near the Money and
 * red over it, as the budget bar's cost gauge does.
 */
function TurnSpendLine({
  spendMillions,
  moneyMillions,
}: {
  spendMillions: number;
  moneyMillions: number;
}) {
  const { spent, rest, level } = turnSpend(spendMillions, moneyMillions);
  return (
    <span className={`turn-spend ${level}`} data-testid="turn-spend">
      {level !== "within" && <Icon name="alert-triangle" />}
      <span data-testid="turn-spend-amount">{spent}</span>{" "}
      <GameText>this Turn</GameText>
      {" · "}
      <span data-testid="turn-spend-left">{rest}</span>
    </span>
  );
}

interface StatusValueProps {
  icon: IconName;
  term: string;
  testId: string;
  children: ReactNode;
  change?: number | undefined;
  unit?: "points" | "money";
  /**
   * What the value's tooltip says after what Base funding is: the Money's base funding and its exact figure. Only the
   * Money has one.
   */
  detail?: string | undefined;
  /** A small line under the value, such as what this Turn will spend. */
  caption?: ReactNode;
}

function StatusValue({
  icon,
  term,
  testId,
  children,
  change,
  unit,
  detail,
  caption,
}: StatusValueProps) {
  return (
    <div>
      <dt>
        <Icon name={icon} />
        <GameText>{term}</GameText>
      </dt>
      <dd className="status-value">
        {detail ? (
          <span
            className="term"
            data-term="Base funding"
            data-detail={detail}
            data-testid={testId}
            tabIndex={0}
          >
            {children}
          </span>
        ) : (
          <span data-testid={testId}>{children}</span>
        )}
        <Change change={change} unit={unit} testId={`${testId}-change`} />
      </dd>
      {caption && <dd className="status-caption">{caption}</dd>}
    </div>
  );
}

interface ChangeProps {
  change: number | undefined;
  unit?: "points" | "money" | undefined;
  testId: string;
}

/** How much a value changed over the last Turn, or nothing if it didn't, with money to three significant figures. */
function Change({ change, unit, testId }: ChangeProps) {
  if (change === undefined) return null;
  return (
    <span
      className={`status-change ${change > 0 ? "up" : "down"}`}
      data-testid={testId}
    >
      {formatChange(unit === "money" ? toThreeFigures(change) : change, unit)}
    </span>
  );
}
