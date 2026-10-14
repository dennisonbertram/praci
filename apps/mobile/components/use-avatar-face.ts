import type { AvatarFacePose, AvatarMood } from "@rakazo/core";
import { avatarFacePose, blendAvatarFacePose } from "@rakazo/core";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  useAnimatedProps,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
} from "react-native-reanimated";
import {
  type AvatarFaceGeometry,
  faceFrame,
  MIN_ANIMATED_SIZE,
  MOOD_BLEND_MS,
} from "../lib/avatar-face";

type Look = { x: number; y: number };

/**
 * Drives an avatar's eyes from the shared eye engine. One frame callback per
 * avatar computes the pose on the UI thread and writes `frame`; the returned
 * animated props feed the two eye `Path`s. Reduced motion renders the static
 * pose at t=0 with no frame callback. `geometry` must be memoized.
 */
export function useAvatarFace(options: {
  seed: number;
  mood: AvatarMood;
  size: number;
  geometry: AvatarFaceGeometry;
  lookAt?: Look;
}) {
  const { seed, mood, size, geometry, lookAt } = options;
  const reducedMotion = useReducedMotion();
  const frozen = size < MIN_ANIMATED_SIZE;
  const lookX = frozen ? 0 : lookAt?.x;
  const lookY = frozen ? 0 : lookAt?.y;
  const look = lookX === undefined || lookY === undefined ? null : { x: lookX, y: lookY };

  const [initial] = useState(() =>
    faceFrame(avatarFacePose(seed, mood, 0, look ?? undefined), geometry),
  );
  const frame = useSharedValue(initial);
  const moodValue = useSharedValue<AvatarMood>(mood);
  const lookValue = useSharedValue<Look | null>(look);
  const geometryValue = useSharedValue(geometry);
  const seedValue = useSharedValue(seed);
  const last = useSharedValue<AvatarFacePose | null>(null);
  const from = useSharedValue<AvatarFacePose | null>(null);
  const startedAt = useSharedValue(-1);
  const mounted = useRef(false);

  // Ease from the pose on screen when the mood changes (not on first mount or reduced motion).
  useEffect(() => {
    from.value = mounted.current && !reducedMotion ? last.value : null;
    startedAt.value = -1;
    mounted.current = true;
    moodValue.value = mood;
  }, [mood, reducedMotion, from, last, startedAt, moodValue]);

  useEffect(() => {
    lookValue.value = lookX === undefined || lookY === undefined ? null : { x: lookX, y: lookY };
    geometryValue.value = geometry;
    seedValue.value = seed;
    if (reducedMotion) {
      frame.value = faceFrame(
        avatarFacePose(seed, mood, 0, lookValue.value ?? undefined),
        geometry,
      );
    }
  }, [
    seed,
    mood,
    reducedMotion,
    lookX,
    lookY,
    geometry,
    lookValue,
    geometryValue,
    seedValue,
    frame,
  ]);

  useFrameCallback((info) => {
    "worklet";
    const t = info.timeSinceFirstFrame;
    let pose = avatarFacePose(seedValue.value, moodValue.value, t, lookValue.value ?? undefined);
    const previous = from.value;
    if (previous) {
      if (startedAt.value < 0) startedAt.value = t;
      const u = (t - startedAt.value) / MOOD_BLEND_MS;
      if (u >= 1) from.value = null;
      else pose = blendAvatarFacePose(previous, pose, 1 - (1 - u) ** 3);
    }
    last.value = pose;
    frame.value = faceFrame(pose, geometryValue.value);
  }, !reducedMotion);

  const leftProps = useAnimatedProps(() => ({ d: frame.value.leftD }));
  const rightProps = useAnimatedProps(() => ({ d: frame.value.rightD }));
  return { frame, leftProps, rightProps, initial };
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
