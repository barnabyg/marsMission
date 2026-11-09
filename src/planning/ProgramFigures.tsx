import type { ReactNode } from "react";
import { formatMoney, type ProgramSummary } from "../simulation/simulation";
import { GameText } from "../ui/GameText";
import { Icon, type IconName } from "../ui/Icon";

interface FigureProps {
  icon: IconName;
  name: string;
  value: string;
  testId: string;
  children?: ReactNode;
}

/** One figure for the whole Program, as a card like the Turn summary's. */
function Figure({ icon, name, value, testId, children }: FigureProps) {
  return (
    <section className="value-change" data-testid={testId}>
      <h2>
        <Icon name={icon} />
        <GameText heading>{name}</GameText>
      </h2>
      <p className="value-change-values">
        <span>
          <GameText>{value}</GameText>
        </span>
      </p>
      {children && <p className="program-figure-detail">{children}</p>}
    </section>
  );
}

const plural = (count: number, one: string, many = `${one}s`) =>
  `${String(count)} ${count === 1 ? one : many}`;

/**
 * How long the Program ran, its Missions, where its Science, Public Support and Money got to, and its Crew and samples
 * home if there were any.
 */
export function ProgramFigures({ summary }: { summary: ProgramSummary }) {
  const { turnsPlayed, years, missionsLaunched, missionsLost } = summary;
  const { crew, samplesHome } = summary;
  return (
    <div className="program-figures">
      <Figure
        icon="calendar"
        name="Turns"
        value={`${plural(turnsPlayed, "Turn")} played`}
        testId="program-turns"
      >
        {turnsPlayed > 0 && `Over about ${plural(years, "year")}`}
      </Figure>
      <Figure
        icon="rocket"
        name="Missions"
        value={`${String(missionsLaunched)} launched`}
        testId="program-missions"
      >
        <GameText>{`${String(missionsLost)} lost to a failure`}</GameText>
      </Figure>
      <Figure
        icon="flask-conical"
        name="Science"
        value={String(summary.science)}
        testId="program-science"
      />
      <Figure
        icon="users"
        name="Highest Public Support"
        value={String(summary.peakPublicSupport)}
        testId="program-peak-public-support"
      />
      <Figure
        icon="coins"
        name="Money left"
        value={formatMoney(summary.moneyMillions)}
        testId="program-money"
      />
      {crew.flown > 0 && (
        <Figure
          icon="heart"
          name="Crew"
          value={`${String(crew.flown)} flew`}
          testId="program-crew"
        >
          {`${String(crew.home)} came home, ${String(crew.lost)} lost`}
        </Figure>
      )}
      {samplesHome > 0 && (
        <Figure
          icon="package"
          name="Samples home"
          value={String(samplesHome)}
          testId="program-samples"
        />
      )}
    </div>
  );
}
