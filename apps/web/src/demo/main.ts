// install.ts must run before any app module loads: the auth client keeps the `fetch` it finds
// when it loads, so the app is imported afterwards.
import "./install";

void import("../main");
