import type { AvatarEyePose, AvatarFacePose, AvatarMood } from "@rakazo/core";
import { avatarEyePath, avatarFacePose, blendAvatarFacePose } from "@rakazo/core";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { frozenAvatarTime, subscribeAvatarTicker } from "./avatar-ticker.js";

export interface AvatarFaceGeometry {
  /** Eye centers in the SVG's user units. */
  eyes: readonly [{ cx: number; cy: number }, { cx: number; cy: number }];
  /** Full-size eye dimensions. */
  w: number;
  h: number;
  /** Gaze travel for gaze = +-1. */
  travelX: number;
  travelY: number;
  /** Body transform center and bounce distance per unit of `bob`. Omit to keep the body still. */
  body?: { cx: number; cy: number; bob: number };
}

/** Below this size gaze is frozen and the eyes only blink. */
const MIN_ANIMATED_SIZE = 24;
const MOOD_BLEND_MS = 220;

const r2 = (n: number) => Math.round(n * 100) / 100;

export function eyeAttributes(pose: AvatarEyePose, g: AvatarFaceGeometry, index: 0 | 1) {
  const eye = g.eyes[index];
  const tilt = index === 0 ? pose.tilt : -pose.tilt;
  return {
    d: avatarEyePath(g.w, g.h, pose),
    transform: `translate(${r2(eye.cx + pose.x * g.travelX)} ${r2(eye.cy + pose.y * g.travelY)}) rotate(${r2(tilt)})`,
  };
}

export function bodyTransform(pose: AvatarFacePose, body: NonNullable<AvatarFaceGeometry["body"]>) {
  const sx = 1 - pose.squash * 0.6;
  const sy = 1 + pose.squash;
  return `translate(${body.cx} ${r2(body.cy + pose.bob * body.bob)}) scale(${r2(sx * 1000) / 1000} ${r2(sy * 1000) / 1000}) translate(${-body.cx} ${-body.cy})`;
}

const reducedMotionMedia = "(prefers-reduced-motion: reduce)";

export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(reducedMotionMedia);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => window.matchMedia(reducedMotionMedia).matches,
    () => false,
  );
}

/**
 * Drives an avatar's eyes and body from the shared ticker. Render the returned
 * `initial` attributes and attach the refs; frames write DOM attributes directly,
 * so nothing re-renders per frame.
 */
export function useAvatarFace(options: {
  seed: number;
  mood: AvatarMood;
  size: number;
  geometry: AvatarFaceGeometry;
  lookAt?: { x: number; y: number };
}) {
  const { seed, mood, size, geometry, lookAt } = options;
  const reducedMotion = useReducedMotion();
  const leftRef = useRef<SVGPathElement>(null);
  const rightRef = useRef<SVGPathElement>(null);
  const bodyRef = useRef<SVGGElement>(null);
  const geometryRef = useRef(geometry);
  geometryRef.current = geometry;
  const lastPose = useRef<AvatarFacePose | null>(null);
  const lookX = size < MIN_ANIMATED_SIZE ? 0 : lookAt?.x;
  const lookY = size < MIN_ANIMATED_SIZE ? 0 : lookAt?.y;

  useEffect(() => {
    const look = lookX === undefined || lookY === undefined ? undefined : { x: lookX, y: lookY };
    let from = reducedMotion || frozenAvatarTime() !== null ? null : lastPose.current;
    let startedAt: number | null = null;
    const apply = (timeMs: number) => {
      const reduced = reducedMotion;
      let pose = avatarFacePose(seed, mood, reduced ? 0 : timeMs, look);
      if (from) {
        startedAt ??= timeMs;
        const u = (timeMs - startedAt) / MOOD_BLEND_MS;
        if (u >= 1) from = null;
        else pose = blendAvatarFacePose(from, pose, 1 - (1 - u) ** 3);
      }
      lastPose.current = pose;
      const g = geometryRef.current;
      for (const [ref, eye, index] of [
        [leftRef, pose.left, 0],
        [rightRef, pose.right, 1],
      ] as const) {
        const attrs = eyeAttributes(eye, g, index);
        ref.current?.setAttribute("d", attrs.d);
        ref.current?.setAttribute("transform", attrs.transform);
      }
      if (g.body) bodyRef.current?.setAttribute("transform", bodyTransform(pose, g.body));
    };
    if (reducedMotion) {
      apply(0);
      return;
    }
    return subscribeAvatarTicker(apply);
  }, [seed, mood, size, reducedMotion, lookX, lookY]);

  const initial = avatarFacePose(seed, mood, 0);
  return {
    leftRef,
    rightRef,
    bodyRef,
    initial: {
      left: eyeAttributes(initial.left, geometry, 0),
      right: eyeAttributes(initial.right, geometry, 1),
      body: geometry.body ? bodyTransform(initial, geometry.body) : undefined,
    },
  };
}

/** One-shot emote: `[mood, emote]`. Pass `mood` to `BotAvatar`; it clears itself after `ms`. */
export function useAvatarReaction(): [
  AvatarMood | undefined,
  (mood: AvatarMood, ms?: number) => void,
] {
  const [mood, setMood] = useState<AvatarMood>();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const emote = useCallback((next: AvatarMood, ms = 1600) => {
    clearTimeout(timer.current);
    setMood(next);
    timer.current = setTimeout(() => setMood(undefined), ms);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return [mood, emote];
}
