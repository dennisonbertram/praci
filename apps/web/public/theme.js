// Runs before first paint, as a file because the app's CSP blocks inline scripts.
(() => {
  const key = "rakazo.uiAppearance";
  let preference = "system";
  try {
    const stored = localStorage.getItem(key);
    if (stored === "system" || stored === "light" || stored === "dark") preference = stored;
  } catch {}
  const systemLight =
    typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: light)").matches;
  const theme = preference === "system" ? (systemLight ? "light" : "dark") : preference;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "light" ? "#fafaf8" : "#1c1c1a");
})();
