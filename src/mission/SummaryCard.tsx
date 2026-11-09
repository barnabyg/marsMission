import type { ReactNode } from "react";
import { GameText } from "../ui/GameText";

/** One headed card of the Turn summary, under Money, Science and Public Support, which every part of it is put in. */
export interface SummaryCardContent {
  key: string;
  heading: string;
  /** Marks a card that reports a loss, with its heading and border in the problem colour. */
  problem?: boolean;
  /** Takes a row of its own, as Milestones do when there are several. */
  wide?: boolean;
  className?: string;
  testId?: string;
  role?: "alert";
  content: ReactNode;
}

/** A card of the Turn summary's grid, spanning as many of its columns as it is given. */
export function SummaryCard({
  card,
  span,
}: {
  card: SummaryCardContent;
  span: number;
}) {
  const classes = [
    "summary-card",
    card.problem ? "problem-card" : "",
    span > 1 ? `span-${String(span)}` : "",
    card.className ?? "",
  ].filter(Boolean);
  return (
    <section
      className={classes.join(" ")}
      data-testid={card.testId}
      role={card.role}
    >
      <h2 className={card.problem ? "problem" : undefined}>
        <GameText heading>{card.heading}</GameText>
      </h2>
      {card.content}
    </section>
  );
}

/** Text under a card's heading, or a part of a card with a heading of its own, as one block. */
export function SummaryPart({
  heading,
  problem = false,
  testId,
  children,
}: {
  heading: string;
  problem?: boolean;
  testId?: string;
  children: ReactNode;
}) {
  return (
    <section className="summary-part" data-testid={testId}>
      <h3 className={problem ? "problem" : undefined}>
        <GameText heading>{heading}</GameText>
      </h3>
      {children}
    </section>
  );
}
