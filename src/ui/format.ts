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
