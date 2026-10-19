# Brief: Inbox sync-problem states (demo data, all invented)

Rakazo is a founder's AI chief-of-staff app (dark, monochrome UI; status colours only destructive/success/warning;
minimal copy; progressive disclosure). Screenshots show the Inbox page when Gmail sync has a problem.

States in the screenshots:
- `*-rate-limited`: Gmail is rate-limiting and no mail is cached, so the whole page body is an empty state
  ("Your mail didn't load", "Gmail is limiting requests right now. Try again in a few seconds.", Try again).
- `*-retrying`: Try again pressed; the button is disabled with a spinner. The spinner runs about 11 s (measured).
- `*-after-retry`: still limited; the page is identical to the first rate-limited view (no new message).
- `*-reconnect`: Gmail sign-in lapsed ("Gmail needs to be reconnected", Reconnect Gmail).
- `*-banner-cached`: simulated: mail rows are cached, so one red line plus a small Try again button sits above the list.
- `*-healthy`: baseline.

Judge as a ruthless senior product designer and as a first-time user. For each image give concrete findings:
element, problem, the design norm violated (hierarchy, colour semantics, contrast, touch targets, copy clarity,
consistency between the rate-limit and reconnect notices, feedback while retrying, empty vs cached distinction),
and a severity P0 (misleads) to P3 (polish). Cite what you can see in the pixels; say "cannot tell" instead of guessing.
Also say what is excellent. Keep it to 12 findings or fewer.
