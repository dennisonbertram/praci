import { Trans, useLingui } from "@lingui/react/macro";
import type { LinkFavicons } from "@rakazo/chat-ui/web";
import { HideAmountsContext, LinkFaviconsContext, RemoteImagesContext } from "@rakazo/chat-ui/web";
import { LOCAL_SETTINGS_PAGE } from "@rakazo/contracts";
import { Button } from "@rakazo/ui-web";
import {
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { LoadingState } from "./components/ai/primitives";
import { DataRoomDropZone } from "./components/data-room/DropZone";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { MailOutbox } from "./components/MailOutbox";
import { ShellSkeleton } from "./components/ShellSkeleton";
import { SubscriptionGate } from "./components/SubscriptionGate";
import { authClient } from "./lib/auth";
import { getTicketBoardEnabled, subscribeTicketBoardEnabled } from "./lib/bootstrap";
import { useHideAmounts } from "./lib/hide-amounts-preference";
import { markAfterPaint, markOnce } from "./lib/performance";
import { getRemoteImagesEnabled, subscribeRemoteImages } from "./lib/remote-images-preference";
import { rpc } from "./lib/rpc";
import {
  holdUnreachableGate,
  sessionGate,
  sessionRetryDelayMs,
  showSessionUnavailable,
} from "./lib/session-gate";
import { signInFor, signInNext } from "./lib/sign-in-next";
import { completeSsoCallback, SSO_CALLBACK_PATH } from "./lib/sso-flow";
import { ConnectedCallbackPage } from "./pages/ConnectedCallback";
import { GoogleOAuthCallbackPage } from "./pages/GoogleOAuthCallback";
import { LocalSettingsPage } from "./pages/LocalSettings";
import { McpOAuthCallbackPage } from "./pages/McpOAuthCallback";
import { ShellPage } from "./pages/Shell";

const AuthPage = lazy(() =>
  import("./pages/Auth").then((module) => ({ default: module.AuthPage })),
);
const PasswordResetPage = lazy(() =>
  import("./pages/Auth").then((module) => ({ default: module.PasswordResetPage })),
);
const OnboardingPage = lazy(() =>
  import("./pages/Onboarding").then((module) => ({ default: module.OnboardingPage })),
);
const WelcomePage = lazy(() =>
  import("./pages/Welcome").then((module) => ({ default: module.WelcomePage })),
);
const NotFoundPage = lazy(() =>
  import("./pages/NotFound").then((module) => ({ default: module.NotFoundPage })),
);

function SsoCallbackPage() {
  useEffect(() => {
    completeSsoCallback();
  }, []);
  return null;
}

// Link icons come from our API, which fetches and caches them; the browser never asks the site.
const linkFavicons: LinkFavicons = {
  load: (origin) => rpc.links.favicon({ origin }),
};

export function App() {
  const hideAmounts = useHideAmounts();
  const loadRemoteImages = useSyncExternalStore(
    subscribeRemoteImages,
    getRemoteImagesEnabled,
    () => false,
  );
  return (
    <RemoteImagesContext.Provider value={loadRemoteImages}>
      <HideAmountsContext.Provider value={hideAmounts}>
        <LinkFaviconsContext.Provider value={linkFavicons}>
          <ErrorBoundary fallback={<AppFailed />}>
            {window.location.pathname === SSO_CALLBACK_PATH ? (
              <SsoCallbackPage />
            ) : window.location.pathname === LOCAL_SETTINGS_PAGE ? (
              <LocalSettingsPage />
            ) : (
              <SessionApp />
            )}
          </ErrorBoundary>
        </LinkFaviconsContext.Provider>
      </HideAmountsContext.Provider>
    </RemoteImagesContext.Provider>
  );
}

function SessionApp() {
  const [searchParams] = useSearchParams();
  const signInDestination = signInNext(searchParams.get("next"));
  const ticketBoardEnabled = useSyncExternalStore(
    subscribeTicketBoardEnabled,
    getTicketBoardEnabled,
    () => false,
  );
  const session = authClient.useSession();
  const gate = sessionGate(session);
  const [holdingUnreachable, setHoldingUnreachable] = useState(false);
  const nextHolding = holdUnreachableGate(gate, holdingUnreachable);
  if (nextHolding !== holdingUnreachable) setHoldingUnreachable(nextHolding);

  useLayoutEffect(() => {
    if (session.isPending) return;
    markOnce("rk:renderer:session-committed");
    markAfterPaint("rk:renderer:session-painted");
  }, [session.isPending]);

  if (showSessionUnavailable(gate, nextHolding)) {
    return <SessionUnavailable refetch={session.refetch} />;
  }
  if (gate === "loading") {
    // /integrations/* also opens inside the shell, so it waits behind the same skeleton.
    const { pathname } = window.location;
    return pathname.startsWith("/app") || pathname.startsWith("/integrations") ? (
      <ShellSkeleton />
    ) : (
      <div
        className="grid h-full place-items-center text-muted-foreground/80"
        data-rakazo-app-state="session-pending"
      >
        <Trans>Loading…</Trans>
      </div>
    );
  }

  const user = session.data?.user;
  return (
    <div className="h-full" data-rakazo-app-state="ready">
      <Suspense fallback={<div className="h-full bg-background" />}>
        <Routes>
          <Route path="/" element={user ? <Navigate to="/app" replace /> : <WelcomePage />} />
          <Route
            path="/sign-in"
            element={
              user ? <Navigate to={signInDestination} replace /> : <AuthPage key="in" mode="in" />
            }
          />
          <Route
            path="/sign-up"
            element={user ? <Navigate to="/onboarding" replace /> : <AuthPage key="up" mode="up" />}
          />
          <Route
            path="/forgot-password"
            element={
              user ? <Navigate to="/app" replace /> : <AuthPage key="forgot" mode="forgot" />
            }
          />
          <Route path="/reset-password" element={<PasswordResetPage />} />
          <Route
            path="/mcp/oauth/callback"
            element={user ? <McpOAuthCallbackPage /> : <Navigate to="/sign-in" replace />}
          />
          <Route
            path="/models/openrouter/callback"
            element={
              user ? (
                <McpOAuthCallbackPage provider="openrouter" />
              ) : (
                <Navigate to="/sign-in" replace />
              )
            }
          />
          <Route
            path="/models/openrouter/callback/:state"
            element={
              user ? (
                <McpOAuthCallbackPage provider="openrouter" />
              ) : (
                <Navigate to="/sign-in" replace />
              )
            }
          />
          <Route
            path="/integrations/google/callback"
            element={user ? <GoogleOAuthCallbackPage /> : <Navigate to="/sign-in" replace />}
          />
          <Route path="/integrations/connected" element={<ConnectedCallbackPage />} />
          {/* Setup links from the server use this path; the page itself lives inside the shell. */}
          <Route path="/integrations/setup" element={<LegacySetupRedirect />} />
          <Route
            element={
              user ? (
                <SubscriptionGate fallback={<GateFallback />}>
                  <Outlet />
                  <MailOutbox />
                  <DataRoomDropZone userId={user?.id ?? null} />
                </SubscriptionGate>
              ) : (
                <SignInRedirect />
              )
            }
          >
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/app" element={<ShellPage />} />
            <Route path="/app/g/:groupId" element={<ShellPage />} />
            <Route path="/app/artifacts" element={<ShellPage />} />
            <Route path="/app/artifacts/:artifactId" element={<ShellPage />} />
            {/* The board opens inside the shell, so the sidebar stays. */}
            {ticketBoardEnabled ? <Route path="/app/board" element={<ShellPage />} /> : null}
            <Route path="/app/inbox" element={<ShellPage />} />
            <Route path="/app/integrations/*" element={<ShellPage />} />
            <Route path="/app/finance/*" element={<ShellPage />} />
            <Route path="/app/legal" element={<ShellPage />} />
            <Route path="/app/devin" element={<ShellPage />} />
            <Route path="/app/data-room" element={<ShellPage />} />
            <Route path="/app/investors/*" element={<ShellPage />} />
            <Route path="/app/fundraising" element={<ShellPage />} />
            <Route path="/app/cap-table/*" element={<CapTableRedirect />} />
            <Route path="/app/contacts" element={<ShellPage />} />
            <Route path="/app/:botId" element={<ShellPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </div>
  );
}

/**
 * A session lookup that never reached the server is not a sign-out, so the app
 * waits and retries here instead of routing to sign-in and stranding a signed-in
 * user. Better Auth only polls once a session exists, so the retry lives here.
 */
function LegacySetupRedirect() {
  const { search } = useLocation();
  return <Navigate to={`/app/integrations/setup${search}`} replace />;
}

/** Cap table became Investors; old links keep their query, minus the Carta-only kinds that no longer filter. */
function CapTableRedirect() {
  const { search } = useLocation();
  const rest = useParams()["*"];
  const params = new URLSearchParams(search);
  if (params.get("kind") === "shareholder" || params.get("kind") === "options")
    params.delete("kind");
  const query = params.toString();
  return (
    <Navigate to={`/app/investors${rest ? `/${rest}` : ""}${query ? `?${query}` : ""}`} replace />
  );
}

/** Signed-out visits to an app page come back to that page after sign-in. */
function SignInRedirect() {
  const { pathname, search } = useLocation();
  return <Navigate to={signInFor(pathname + search)} replace />;
}

function SessionUnavailable({ refetch }: { refetch: () => Promise<void> }) {
  const { t } = useLingui();
  const [attempt, setAttempt] = useState(0);
  const [retryKey, setRetryKey] = useState(0);
  const retryImmediately = useRef(false);
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  useEffect(() => {
    let cancelled = false;
    const delay = retryImmediately.current ? 0 : sessionRetryDelayMs(attempt);
    retryImmediately.current = false;
    const timer = setTimeout(() => {
      void refetchRef.current().finally(() => {
        if (!cancelled) setAttempt((value) => value + 1);
      });
    }, delay);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [attempt, retryKey]);

  return (
    <div className="grid h-full place-items-center bg-background px-6 text-center">
      <div className="flex flex-col items-center">
        <LoadingState label={t`Reconnecting`} />
        <p className="mt-3 text-[13.5px] text-muted-foreground/80">
          <Trans>Can&apos;t reach the server.</Trans>
        </p>
        <div className="mt-4">
          <Button
            variant="secondary"
            className="rounded-full"
            onClick={() => {
              retryImmediately.current = true;
              setAttempt(0);
              setRetryKey((key) => key + 1);
            }}
          >
            <Trans>Retry now</Trans>
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Last resort for a render failure no inner boundary caught: offer a reload instead of a blank page. */
function AppFailed() {
  return (
    <div
      className="grid h-full place-items-center bg-background px-6 text-center"
      data-rakazo-app-state="failed"
    >
      <div className="flex flex-col items-center">
        <p className="text-[13.5px] text-muted-foreground/80">
          <Trans>Something went wrong. Try again.</Trans>
        </p>
        <div className="mt-4">
          <Button
            variant="secondary"
            className="rounded-full"
            onClick={() => window.location.reload()}
          >
            <Trans>Refresh</Trans>
          </Button>
        </div>
      </div>
    </div>
  );
}

function GateFallback() {
  return window.location.pathname.startsWith("/app") ? (
    <ShellSkeleton />
  ) : (
    <div className="h-full bg-background" />
  );
}
