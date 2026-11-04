import { formatMoney } from "../simulation/simulation";

const monthYear = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const dayMonthYear = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function formatLaunchWindow(isoDate: string): string {
  return monthYear.format(new Date(`${isoDate}T00:00:00Z`));
}

export function formatDate(isoDate: string): string {
  return dayMonthYear.format(new Date(`${isoDate}T00:00:00Z`));
}

/** A change with its sign, such as "+155" or "−$250M", using a true minus sign. */
export function formatChange(
  change: number,
  unit: "points" | "money" = "points",
): string {
  const size = Math.abs(change);
  const sign = change < 0 ? "−" : "+";
  return `${sign}${unit === "money" ? formatMoney(size) : String(size)}`;
}
