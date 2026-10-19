import type { StorybookConfig } from "@storybook/react-vite";

// The framework loads apps/web/vite.config.ts itself, so the Tailwind and Lingui plugins
// are shared with the app and not repeated here.
const config: StorybookConfig = {
  framework: "@storybook/react-vite",
  stories: [
    "../src/**/*.stories.tsx",
    "../../../packages/ui-web/src/**/*.stories.tsx",
    "../../../packages/chat-ui/src/**/*.stories.tsx",
  ],
  addons: ["@storybook/addon-a11y"],
  // Stands in for the server image proxy (GET /api/inbox/image) so email stories can show remote images.
  viteFinal: (viteConfig) => ({
    ...viteConfig,
    plugins: [
      ...(viteConfig.plugins ?? []),
      {
        name: "stub-email-image-proxy",
        configureServer(server) {
          server.middlewares.use("/api/inbox/image", (_request, response) => {
            response.setHeader("content-type", "image/svg+xml");
            response.end(
              '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="160"><rect width="600" height="160" fill="#9bd"/><text x="300" y="88" font-family="sans-serif" font-size="28" text-anchor="middle" fill="#fff">Stub proxied image</text></svg>',
            );
          });
        },
      },
    ],
  }),
};

export default config;
