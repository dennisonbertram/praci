# J1 proposal B: restructure into one setup screen

Replace the bottom sheet with a full-screen "Set up Praci" page (pushed from the Home card) that holds everything the first run needs.

- Page is a grouped list: (1) Model: provider rows with a trailing checkmark, field below, (2) AI data sharing: three switches (Model, Speech, Memory), Model on and locked while connecting, Speech and Memory off, (3) one prominent button "Connect and continue".
- Consent is explicit and complete in one place; no first-use sheets later for Speech or Memory because the user already chose.
- After success the page dismisses to the Chief thread (not Home) with the composer focused.
- No-model Home card on both devices opens the same page. Failed key shows an inline red line under the field.
- Settings > AI data sharing reuses the same group.

Cost: a heavy first screen (more reading and decisions up front for a new founder, who has to rule on Speech and Memory before using either), a second layout to design for Duo outer display (466 wide), and a new screen where a sheet already exists. Not-sent state still needed.
