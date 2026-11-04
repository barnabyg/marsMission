import type { ReactNode } from "react";
import { formatChange } from "../ui/format";
import { formatMoney, type TurnSummary } from "../simulation/simulation";
import { GameText } from "../ui/GameText";
import { Icon, type IconName } from "../ui/Icon";
import { turnMoney, type MoneyLine } from "./turnMoney";

interface ValueChangeProps {
  icon: IconName;
  name: string;
  before: string;
  after: string;
  change: number;
  unit?: "points" | "money";
  /** Marks the "before to after" text, such as "100 to 85". */
  testId: string;
  children?: ReactNode;
}

/** One value as it was before the Turn and after it, with an arrow for which way it went. */
function ValueChange({
  icon,
  name,
  before,
  after,
  change,
  unit = "points",
  testId,
  children,
}: ValueChangeProps) {
  const direction = change > 0 ? "up" : change < 0 ? "down" : "same";
  return (
    <section className="value-change">
      <h2>
        <Icon name={icon} />
        <GameText>{name}</GameText>
      </h2>
      <p className="value-change-values">
        <span data-testid={testId}>
          {before} <span className="visually-hidden">to</span>
          <Icon name="arrow-right" className="value-change-to" /> {after}
        </span>
        <span
          className={`value-change-delta ${direction}`}
          data-testid={`${testId}-change`}
        >
          {direction === "same" ? (
            "No change"
          ) : (
            <>
              <Icon name={direction === "up" ? "arrow-up" : "arrow-down"} />
              {formatChange(change, unit)}
            </>
          )}
        </span>
      </p>
      {children}
    </section>
  );
}

interface MoneyListProps {
  heading: "Spent" | "Received";
  lines: MoneyLine[];
}

const testIds: Record<string, string> = {
  Development: "summary-development-cost",
};

/** What went out, or came in, each with its amount, under the total it takes off or adds to Money. */
function MoneyList({ heading, lines }: MoneyListProps) {
  const total = lines.reduce((sum, { millions }) => sum + millions, 0);
  return (
    <div data-testid={`summary-money-${heading.toLowerCase()}`}>
      <h3>
        {heading}
        {total !== 0 && (
          <>
            {" "}
            <span data-testid={`summary-money-${heading.toLowerCase()}-total`}>
              {formatChange(heading === "Spent" ? -total : total, "money")}
            </span>
          </>
        )}
      </h3>
      <ul>
        {lines.length === 0 && <li>Nothing</li>}
        {lines.map(({ name, millions }) => (
          <li key={name}>
            <span>
              <GameText>{name}</GameText>
            </span>
            <span data-testid={testIds[name]}>{formatMoney(millions)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Money, Science and Public Support before and after the Turn, with where the Money went and came from. */
export function SummaryChanges({ summary }: { summary: TurnSummary }) {
  const money = turnMoney(summary);
  return (
    <div className="summary-changes">
      <ValueChange
        icon="coins"
        name="Money"
        before={formatMoney(summary.moneyStartMillions)}
        after={formatMoney(summary.moneyEndMillions)}
        change={summary.moneyEndMillions - summary.moneyStartMillions}
        unit="money"
        testId="summary-money"
      >
        <div className="money-lines">
          <MoneyList heading="Spent" lines={money.spent} />
          <MoneyList heading="Received" lines={money.received} />
        </div>
      </ValueChange>
      <ValueChange
        icon="flask-conical"
        name="Science"
        before={String(summary.scienceStart)}
        after={String(summary.scienceStart + summary.scienceGained)}
        change={summary.scienceGained}
        testId="summary-science"
      />
      <ValueChange
        icon="users"
        name="Public Support"
        before={String(summary.publicSupportStart)}
        after={String(summary.publicSupportEnd)}
        change={summary.publicSupportEnd - summary.publicSupportStart}
        testId="summary-public-support"
      >
        <ul className="value-change-parts">
          <li>
            <span>
              <GameText>Gained from Milestones and Ongoing Research</GameText>
            </span>
            <span>{summary.publicSupportGained}</span>
          </li>
          <li>
            <span>
              <GameText>Faded over the Turn</GameText>
            </span>
            <span>{summary.publicSupportDrained}</span>
          </li>
        </ul>
      </ValueChange>
    </div>
  );
}
