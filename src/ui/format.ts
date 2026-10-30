const monthYear = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function formatLaunchWindow(isoDate: string): string {
  return monthYear.format(new Date(`${isoDate}T00:00:00Z`));
}
