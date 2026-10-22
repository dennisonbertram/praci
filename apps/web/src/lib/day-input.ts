/** Today as the YYYY-MM-DD a date field takes, in the viewer's time zone. */
export const todayDay = (now = new Date()) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

/** A date field's day as the ISO timestamp the API takes (noon UTC, so no time zone moves the day). */
export const isoFromDay = (day: string) => `${day}T12:00:00.000Z`;
