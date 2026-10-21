import { isDevinSessionUrl } from "@rakazo/contracts";

/** A link to another app; the tap hands it to the system. */
export type NotificationExternalTarget = { kind: "external"; url: string };

export type NotificationRoute =
  | {
      pathname: "/thread";
      params: { botId: string; threadId?: string; spaceId?: string; name?: string };
    }
  | {
      pathname: "/group-thread";
      params: { groupId: string; threadId?: string; spaceId?: string; name?: string };
    }
  | { pathname: "/inbox" };

export type ThreadSpaceRequest =
  | { action: "show" }
  | { action: "switch"; spaceId: string }
  | { action: "unavailable" };

function singleRouteParam(value: string | string[] | undefined): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (Array.isArray(value) && value.length === 1) return singleRouteParam(value[0]);
  return undefined;
}

function notificationField(data: Record<string, unknown>, key: string): string | undefined {
  const direct = data[key];
  const prefixed = data[`rakazo.${key}`];
  const value = typeof direct === "string" ? direct : prefixed;
  return typeof value === "string" ? singleRouteParam(value) : undefined;
}

/**
 * A bot and a group each have one thread. groupId wins when both are present
 * so a group run does not open that bot's direct chat.
 */
export function notificationOpenTarget(
  data: unknown,
): NotificationRoute | NotificationExternalTarget | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const record = data as Record<string, unknown>;
  const threadId = notificationField(record, "threadId");
  const spaceId = notificationField(record, "spaceId");
  const name = notificationField(record, "name");
  const shared = {
    ...(threadId ? { threadId } : {}),
    ...(spaceId ? { spaceId } : {}),
    ...(name ? { name } : {}),
  };
  // Mobile has only the Inbox page; other pages fall through to a bot or nothing.
  const link = notificationField(record, "link");
  // Checked first: a Devin alert also carries its agent's botId, and the thread is not the target.
  if (link && isDevinSessionUrl(link)) return { kind: "external", url: link };
  if (!threadId && (notificationField(record, "surface") === "inbox" || link === "/inbox")) {
    return { pathname: "/inbox" };
  }
  const groupId = notificationField(record, "groupId");
  if (groupId) return { pathname: "/group-thread", params: { groupId, ...shared } };
  const botId = notificationField(record, "botId");
  if (botId) return { pathname: "/thread", params: { botId, ...shared } };
  // Unified pushes may carry only an in-app link: /app/g/<groupId> or /app/<botId>.
  const match = link?.split(/[?#]/)[0]?.match(/^\/app\/(?:(g)\/)?([^/]+)\/?$/);
  if (match?.[2]) {
    return match[1]
      ? { pathname: "/group-thread", params: { groupId: match[2], ...shared } }
      : { pathname: "/thread", params: { botId: match[2], ...shared } };
  }
  return null;
}

export function notificationOpenTargetFromLink(url: string): NotificationRoute | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "rakazo:") return null;
  const screen = (parsed.hostname || parsed.pathname.replace(/^\//, "")).replace(/\/$/, "");
  const data: Record<string, string> = {};
  for (const [key, value] of parsed.searchParams) data[key] = value;
  if (screen === "thread") {
    delete data.groupId;
  } else if (screen === "group-thread") {
    delete data.botId;
  } else {
    return null;
  }
  // A rakazo:// link opens a screen; only a notification's own link may leave the app.
  const target = notificationOpenTarget(data);
  return target && "pathname" in target ? target : null;
}

export function notificationSpaceId(data: unknown): string | undefined {
  if (!data || typeof data !== "object" || Array.isArray(data)) return undefined;
  return notificationField(data as Record<string, unknown>, "spaceId");
}

/** The page surface a notification belongs to, for marking it seen. Threads track their own unread. */
export function notificationSurface(data: unknown): string | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const surface = notificationField(data as Record<string, unknown>, "surface");
  return surface && surface !== "thread" ? surface : null;
}

export function notificationResponseRoute(
  response: {
    actionIdentifier: string;
    notification: { request: { content: { data?: unknown } } };
  },
  defaultActionIdentifier: string,
): NotificationRoute | NotificationExternalTarget | null {
  if (response.actionIdentifier !== defaultActionIdentifier) return null;
  return notificationOpenTarget(response.notification.request.content.data);
}

export function threadSpaceRequest(
  spaceId: string | string[] | undefined,
  selectedSpaceId: string | null,
): ThreadSpaceRequest {
  if (spaceId === undefined) return { action: "show" };
  const requested = singleRouteParam(spaceId);
  if (!requested) return { action: "unavailable" };
  if (requested === selectedSpaceId) return { action: "show" };
  return { action: "switch", spaceId: requested };
}

export function threadSpaceSwitchResult(
  requestedSpaceId: string,
  switched: boolean,
  selectedSpaceId: string | null,
): "ready" | "failed" {
  return switched && selectedSpaceId === requestedSpaceId ? "ready" : "failed";
}

export type ThreadRouteFocus = {
  focused: boolean;
  appliedFocus: boolean;
  activeSpaceId: string | null;
  liveSpaceId: string | null;
  switchFailed: boolean;
};

/** When a covered thread route is shown again, follow the space selected now. */
export function threadRouteSpaceOnFocus(input: ThreadRouteFocus): ThreadRouteFocus {
  if (input.focused === input.appliedFocus) return input;
  if (!input.focused) return { ...input, appliedFocus: false };
  return {
    focused: true,
    appliedFocus: true,
    activeSpaceId: input.liveSpaceId,
    liveSpaceId: input.liveSpaceId,
    switchFailed: false,
  };
}
