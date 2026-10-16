import { LOCAL_SETTINGS_PAGE } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { lazy, Suspense } from "react";
import { mockRpc } from "./lib/__mocks__/rpc";

// App starts a session request when its module loads. Loading it here, after the story's
// beforeEach has answered fetch, keeps that first request away from the network.
const App = lazy(() => import("./App").then((module) => ({ default: module.App })));

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const never = () => new Promise<Response>(() => undefined);
const session = {
  session: {
    id: "session_demo",
    userId: "user_demo",
    token: "token_demo",
    expiresAt: "2099-01-01T00:00:00.000Z",
  },
  user: { id: "user_demo", email: "demo@example.com", name: "Demo User", emailVerified: true },
};

/**
 * App reads window.location and calls the session endpoint directly, so a story sets the
 * page path and answers fetch itself. The returned function restores both.
 */
function setup(path: string, answer: (url: string) => Promise<Response> | Response) {
  const originalFetch = window.fetch;
  const originalPath = window.location.pathname + window.location.search;
  window.history.pushState(null, "", path);
  window.fetch = (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    return url.includes("/api/") ? Promise.resolve(answer(url)) : originalFetch(input, init);
  };
  return () => {
    window.fetch = originalFetch;
    window.history.pushState(null, "", originalPath);
  };
}

const meta = {
  title: "App/App",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: "Also shows: SessionApp, SessionUnavailable, GateFallback, ShellSkeleton.",
      },
    },
  },
  render: () => (
    <div className="h-[560px]">
      <Suspense fallback={null}>
        <App />
      </Suspense>
    </div>
  ),
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** The session lookup did not reach the server: reconnect screen with a retry button. */
export const ServerUnreachable: Story = {
  beforeEach: () => setup("/sign-in", () => json({ message: "down" }, 503)),
};

/** The session is still loading on an app path: the shell skeleton. */
export const OpeningSpace: Story = {
  beforeEach: () => setup("/app", never),
};

/** The session is still loading on any other path. */
export const SessionPending: Story = {
  beforeEach: () => setup("/sign-in", never),
};

/** Signed in, but the subscription check has not answered, so the skeleton holds the place. */
export const CheckingSubscription: Story = {
  beforeEach: () => {
    mockRpc({ me: null });
    return setup("/app", (url) => (url.includes("get-session") ? json(session) : never()));
  },
};

/** No session (401): the signed-out Welcome page. */
export const SignedOut: Story = {
  beforeEach: () => setup("/", () => json(null, 401)),
};

/** The local server settings page, picked by path before any session lookup. */
export const LocalSettings: Story = {
  beforeEach: () => {
    mockRpc({ "integrationSetup.get": {} });
    return setup(LOCAL_SETTINGS_PAGE, () => json(null, 401));
  },
};
