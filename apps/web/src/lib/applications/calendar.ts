function formatCalendarDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

// Prefilled "add event" link: works for any Google account without OAuth.
export function buildGoogleCalendarUrl(input: {
  title: string;
  details: string;
  start: Date;
  durationMinutes?: number;
}) {
  const end = new Date(input.start.getTime() + (input.durationMinutes ?? 60) * 60 * 1000);
  const url = new URL("https://calendar.google.com/calendar/render");

  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set("text", input.title);
  url.searchParams.set("dates", `${formatCalendarDate(input.start)}/${formatCalendarDate(end)}`);
  url.searchParams.set("details", input.details);

  return url.toString();
}
