import { lingui } from "@lingui/vite-plugin";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * The homepage demo: the real app, built as a static page that answers its own requests
 * (src/demo/install.ts). `pnpm --filter @rakazo/web build:demo` writes it into the site's
 * public/demo, which the site embeds in an iframe. Kept apart from vite.config.ts so none of the
 * dev-server proxies are involved.
 */
export default defineConfig({
  base: "/demo/",
  plugins: [
    react(),
    babel({ plugins: ["@lingui/babel-plugin-lingui-macro"] }),
    lingui(),
    tailwindcss(),
  ],
  build: {
    outDir: "../praci-waitlist/public/demo",
    emptyOutDir: true,
    rollupOptions: { input: "demo.html" },
  },
});
