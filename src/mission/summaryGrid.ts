/** The Turn summary's columns: Money, Science and Public Support across the top, and the cards under them. */
export const summaryColumns = 3;

/**
 * How many columns each card under the value cards spans, in order, so that no row leaves a gap: a wide card takes a
 * row of its own, and the last card of a row that isn't full, such as a card alone in its row, fills what is left.
 */
export function cardSpans(
  cards: readonly { wide?: boolean }[],
  columns = summaryColumns,
): number[] {
  const spans: number[] = [];
  // How many columns the row being filled has used so far.
  let used = 0;
  const closeRow = () => {
    const last = spans.length - 1;
    if (used > 0 && last >= 0)
      spans[last] = (spans[last] ?? 1) + columns - used;
    used = 0;
  };
  for (const { wide } of cards) {
    if (wide) {
      closeRow();
      spans.push(columns);
    } else {
      spans.push(1);
      used += 1;
      if (used === columns) used = 0;
    }
  }
  closeRow();
  return spans;
}
