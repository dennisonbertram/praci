/**
 * One shared requestAnimationFrame loop for every animated avatar. It runs only
 * while at least one avatar is subscribed and the page is visible.
 */
type Listener = (timeMs: number) => void;

const listeners = new Set<Listener>();
let frame = 0;
let frozenMs: number | null = null;

function tick(now: number) {
  frame = requestAnimationFrame(tick);
  for (const listener of listeners) listener(now);
}

function start() {
  if (frame === 0 && !document.hidden) frame = requestAnimationFrame(tick);
}

function stop() {
  cancelAnimationFrame(frame);
  frame = 0;
}

function onVisibilityChange() {
  if (document.hidden) stop();
  else if (listeners.size > 0) start();
}

/** Calls `listener` immediately and on every frame. Returns the unsubscribe function. */
export function subscribeAvatarTicker(listener: Listener): () => void {
  if (listeners.size === 0) document.addEventListener("visibilitychange", onVisibilityChange);
  listeners.add(listener);
  listener(frozenMs ?? performance.now());
  if (frozenMs === null) start();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    }
  };
}

/** Test hook: render every avatar at a fixed time and stop animating. Call before rendering. */
export function freezeAvatarTicker(timeMs: number | null) {
  frozenMs = timeMs;
}

export function frozenAvatarTime(): number | null {
  return frozenMs;
}
