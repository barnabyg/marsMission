import { formatMoney, type ProgramView } from "../simulation/simulation";
import { formatChange, formatLaunchWindow } from "../ui/format";
import { GameText } from "../ui/GameText";
import { Icon, type IconName } from "../ui/Icon";
import { budgetGauge } from "./budgetGauge";
import { changesSinceLastTurn, publicSupportGauge } from "./statusValues";

interface StatusBarProps {
  view: ProgramView;
  /** What the player saw at the start of the last Turn, or null on the first Turn or after a Load, which show no changes. */
  lastTurn: ProgramView | null;
  /** What the choices made so far would spend this Turn, which the status bar shows beside the Money. */
  spendMillions: number;
}

/** Planning Mode's header: where the Program stands, with how each value changed over the last Turn. */
export function StatusBar({ view, lastTurn, spendMillions }: StatusBarProps) {
  const changes = changesSinceLastTurn(lastTurn, view);
  const gauge = publicSupportGauge(view.publicSupport, view.cancellationLevel);
  const threshold = view.nextFundingThreshold;

  return (
    <header className="status-bar">
      <h1>
        <GameText heading>Planning Mode</GameText>
      </h1>
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
        >
          {formatMoney(view.moneyMillions)}
        </StatusValue>
        <TurnSpend
          spendMillions={spendMillions}
          moneyMillions={view.moneyMillions}
        />
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
              <Change
                change={changes.publicSupport}
                testId="public-support-change"
              />
            </span>
            <span className="gauge-track" aria-hidden="true">
              <span
                className="gauge-fill"
                style={{ width: `${String(gauge.fillPercent)}%` }}
              />
              <span
                className="gauge-level"
                style={{ left: `${String(gauge.levelPercent)}%` }}
              />
            </span>
            <span className="gauge-caption">
              {gauge.warning && <Icon name="alert-triangle" />}
              <span>
                <GameText>
                  {gauge.warning
                    ? "Close to the Cancellation Level of"
                    : "Cancellation Level"}
                </GameText>{" "}
                <span data-testid="cancellation-level">
                  {view.cancellationLevel}
                </span>
              </span>
              <Change
                change={changes.cancellationLevel}
                testId="cancellation-level-change"
              />
            </span>
          </dd>
        </div>
        <StatusValue
          icon="target"
          term="Next Funding Threshold"
          testId="next-funding-threshold"
        >
          {threshold
            ? `${formatMoney(threshold.payoutMillions)} at ${String(threshold.publicSupport)} (${String(threshold.pointsAway)} away)`
            : "None left"}
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

/**
 * What this Turn will spend and what that leaves, beside the Money and in its style, turning amber near the Money and
 * red over it, as the budget bar's cost gauge does.
 */
function TurnSpend({
  spendMillions,
  moneyMillions,
}: {
  spendMillions: number;
  moneyMillions: number;
}) {
  const { level } = budgetGauge(spendMillions, moneyMillions);
  const leftMillions = moneyMillions - spendMillions;
  return (
    <div className={`turn-spend ${level}`} data-testid="turn-spend">
      <dt>
        <Icon name={level === "within" ? "coins" : "alert-triangle"} />
        <GameText>Spend this Turn</GameText>
      </dt>
      <dd className="status-value">
        <span data-testid="turn-spend-amount">
          {formatMoney(spendMillions)}
        </span>
        <span className="turn-spend-left" data-testid="turn-spend-left">
          {leftMillions < 0
            ? `${formatMoney(-leftMillions)} over`
            : `${formatMoney(leftMillions)} left`}
        </span>
      </dd>
    </div>
  );
}

interface StatusValueProps {
  icon: IconName;
  term: string;
  testId: string;
  children: string;
  change?: number | undefined;
  unit?: "points" | "money";
}

function StatusValue({
  icon,
  term,
  testId,
  children,
  change,
  unit,
}: StatusValueProps) {
  return (
    <div>
      <dt>
        <Icon name={icon} />
        <GameText>{term}</GameText>
      </dt>
      <dd className="status-value">
        <span data-testid={testId}>{children}</span>
        <Change change={change} unit={unit} testId={`${testId}-change`} />
      </dd>
    </div>
  );
}

interface ChangeProps {
  change: number | undefined;
  unit?: "points" | "money" | undefined;
  testId: string;
}

/** How much a value changed over the last Turn, or nothing if it didn't. */
function Change({ change, unit, testId }: ChangeProps) {
  if (change === undefined) return null;
  return (
    <span
      className={`status-change ${change > 0 ? "up" : "down"}`}
      data-testid={testId}
    >
      {formatChange(change, unit)}
    </span>
  );
}
