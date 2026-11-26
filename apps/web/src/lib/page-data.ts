import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { errorText } from "./user-error";

/**
 * Loads one RPC for a page. A changed `deps` shows loading, not the previous answer; `reload` keeps the
 * data on screen (a failed reload sets `error` and keeps `data`); `retry` clears both first.
 * `fallback` is the copy for an error that has no message of its own.
 */
export function usePageQuery<T>(
  load: () => Promise<T>,
  deps: readonly unknown[],
  options?: { fallback?: string },
) {
  const key = JSON.stringify(deps);
  const [state, setState] = useState<{
    key: string;
    data: T | null;
    error: string;
    code?: string;
    notFound?: boolean;
  }>({ key, data: null, error: "" });
  const [attempt, setAttempt] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;
  const fallbackRef = useRef(options?.fallback);
  fallbackRef.current = options?.fallback;
  const keyRef = useRef(key);
  keyRef.current = key;
  // `key` stands for `deps`; `attempt` is the manual retrigger.
  useEffect(() => {
    let live = true;
    loadRef
      .current()
      .then((data) => live && setState({ key, data, error: "" }))
      .catch(
        (cause) =>
          live &&
          setState((s) => ({
            key,
            data: s.key === key ? s.data : null,
            error: fallbackRef.current ? errorText(cause, fallbackRef.current) : errorText(cause),
            code: (cause as { code?: string } | null)?.code,
            notFound: (cause as { code?: string } | null)?.code === "NOT_FOUND",
          })),
      );
    return () => {
      live = false;
    };
  }, [key, attempt]);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const retry = useCallback(() => {
    setState({ key: keyRef.current, data: null, error: "" });
    setAttempt((n) => n + 1);
  }, []);
  /** Edits the loaded data in place, for a change the page already knows the answer to. */
  const mutate = useCallback((edit: (data: T) => T) => {
    setState((s) => (s.key === keyRef.current && s.data ? { ...s, data: edit(s.data) } : s));
  }, []);
  const current = state.key === key;
  return {
    data: current ? state.data : null,
    error: current ? state.error : "",
    /** The error's code, such as BREX_TOKEN_REJECTED; undefined when there is no error. */
    code: current ? state.code : undefined,
    /** The server answered NOT_FOUND: retrying will not help. */
    notFound: current && state.notFound === true,
    reload,
    retry,
    mutate,
  };
}

/** Calls `reload` when the agent stops answering: a chat turn can change what the page shows. */
export function useReloadWhenAgentIdle(agentBusy: boolean | undefined, reload: () => void) {
  const wasBusy = useRef(agentBusy);
  const latest = useRef(reload);
  latest.current = reload;
  useEffect(() => {
    if (wasBusy.current && !agentBusy) latest.current();
    wasBusy.current = agentBusy;
  }, [agentBusy]);
}

/**
 * Calls `tick` every `intervalMs` while `active` and the tab is visible. With `giveUpMs` the polling
 * stops that long after it began (hidden time counts) and `onGiveUp` runs.
 */
export function usePollWhile(
  active: boolean,
  intervalMs: number,
  tick: () => void,
  opts?: { giveUpMs?: number; onGiveUp?: () => void },
) {
  const latest = useRef({ tick, onGiveUp: opts?.onGiveUp });
  latest.current = { tick, onGiveUp: opts?.onGiveUp };
  const giveUpMs = opts?.giveUpMs;
  useEffect(() => {
    if (!active) return;
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") latest.current.tick();
    }, intervalMs);
    const stop =
      giveUpMs === undefined
        ? undefined
        : setTimeout(() => {
            clearInterval(poll);
            latest.current.onGiveUp?.();
          }, giveUpMs);
    return () => {
      clearInterval(poll);
      if (stop) clearTimeout(stop);
    };
  }, [active, intervalMs, giveUpMs]);
}

/**
 * One URL query parameter as state. Setting it to the fallback removes it; other parameters stay, and
 * the change replaces the history entry.
 */
export function useUrlParam(name: string, fallback: string): [string, (value: string) => void] {
  const [params, setParams] = useSearchParams();
  const set = useCallback(
    (value: string) =>
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (value === fallback) next.delete(name);
          else next.set(name, value);
          return next;
        },
        { replace: true },
      ),
    [name, fallback, setParams],
  );
  return [params.get(name) ?? fallback, set];
}
