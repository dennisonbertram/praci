import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import {
  currentApiBase,
  currentSpaceSelectionGeneration,
  rpc,
  selectedSpaceId,
  subscribeApiBase,
  subscribeSpaceSelection,
} from "./api";
import { currentSessionGeneration, subscribeSessionGeneration } from "./session";
import { errorText } from "./user-error";

export function companyScope() {
  return `${currentApiBase()}:${selectedSpaceId()}:${currentSpaceSelectionGeneration()}:${currentSessionGeneration()}`;
}

export function useCompanyQuery<T>(procedure: string, input: object = {}, poll = false) {
  const session = useSyncExternalStore(subscribeSessionGeneration, currentSessionGeneration);
  const endpoint = useSyncExternalStore(subscribeApiBase, currentApiBase);
  const selection = useSyncExternalStore(subscribeSpaceSelection, currentSpaceSelectionGeneration);
  const scope = companyScope();
  const body = JSON.stringify(input);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{
    data: T | null;
    error: string;
    loading: boolean;
    scope: string;
    key: string;
  }>({ data: null, error: "", loading: true, scope, key: "" });
  const key = `${procedure}:${body}`;
  const sequence = useRef(0);
  useFocusEffect(
    useCallback(() => {
      const controller = new AbortController();
      const current = ++sequence.current;
      let inFlight = false;
      const load = async () => {
        if (inFlight || AppState.currentState === "background") return;
        inFlight = true;
        try {
          const data = await rpc<T>(procedure, JSON.parse(body), { signal: controller.signal });
          if (
            !controller.signal.aborted &&
            current === sequence.current &&
            scope === companyScope()
          )
            setState({ data, error: "", loading: false, scope, key });
        } catch (error) {
          if (
            !controller.signal.aborted &&
            current === sequence.current &&
            scope === companyScope()
          )
            setState({ data: null, error: errorText(error), loading: false, scope, key });
        } finally {
          inFlight = false;
        }
      };
      setState({ data: null, error: "", loading: true, scope, key });
      void load();
      const subscription = AppState.addEventListener("change", (value) => {
        if (value === "active") void load();
      });
      const timer = poll ? setInterval(() => void load(), 5000) : undefined;
      return () => {
        controller.abort();
        subscription.remove();
        if (timer) clearInterval(timer);
      };
    }, [procedure, body, scope, key, revision, session, endpoint, selection, poll]),
  );
  return {
    ...(state.scope === scope && state.key === key
      ? state
      : { data: null, error: "", loading: true }),
    reload: () => setRevision((value) => value + 1),
  };
}
