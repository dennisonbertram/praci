import { describe, expect, it } from "vitest";
import {
  AVATAR_MOODS,
  avatarEyePath,
  avatarFacePose,
  avatarReactionForTransition,
  blendAvatarFacePose,
  moodForRunStatus,
} from "./avatar-face.js";

const times = Array.from({ length: 600 }, (_, i) => i * 10);
const eye = { x: 0, y: 0, open: 1, smile: 0, tilt: 0, scale: 1 };

describe("avatar face pose", () => {
  it("is deterministic", () => {
    expect(avatarFacePose(7, "idle", 1234)).toEqual(avatarFacePose(7, "idle", 1234));
  });

  it("desynchronizes different seeds", () => {
    const gaze = (seed: number) => times.map((t) => avatarFacePose(seed, "idle", t).left.x);
    expect(gaze(1)).not.toEqual(gaze(2));
  });

  it("blinks within six seconds and reopens", () => {
    const opens = Array.from({ length: 6000 }, (_, t) => avatarFacePose(3, "idle", t).left.open);
    expect(Math.min(...opens)).toBeLessThan(0.15);
    expect(opens.at(-1)).toBeGreaterThan(0.9);
    const firstClosed = opens.findIndex((o) => o < 0.15);
    expect(opens.slice(firstClosed).some((o) => o > 0.95)).toBe(true);
  });

  it("keeps open in 0..1, gaze in -1..1 for every mood", () => {
    for (const mood of AVATAR_MOODS) {
      for (const t of times) {
        const pose = avatarFacePose(5, mood, t * 7);
        for (const e of [pose.left, pose.right]) {
          expect(e.open).toBeGreaterThanOrEqual(0);
          expect(e.open).toBeLessThanOrEqual(1);
          expect(Math.abs(e.x)).toBeLessThanOrEqual(1);
          expect(Math.abs(e.y)).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("holds gaze between quick saccades", () => {
    const xs = times.map((t) => avatarFacePose(9, "idle", t * 5).left.x);
    const jumps = xs.slice(1).filter((x, i) => Math.abs(x - xs[i]!) > 0.1).length;
    expect(jumps).toBeGreaterThan(0);
    expect(jumps).toBeLessThan(40);
  });

  it("expresses moods", () => {
    expect(avatarFacePose(1, "happy", 100).left.smile).toBeCloseTo(1);
    expect(avatarFacePose(1, "sad", 100).left.tilt).toBeLessThan(0);
    expect(avatarFacePose(1, "error", 100).left.tilt).toBeGreaterThan(0);
    expect(avatarFacePose(1, "surprised", 100).left.scale).toBeGreaterThan(1);
    const confused = avatarFacePose(1, "confused", 100);
    expect(confused.left.open).not.toBe(confused.right.open);
  });

  it("looks where lookAt says and clamps", () => {
    const pose = avatarFacePose(1, "idle", 100, { x: 5, y: -0.5 });
    expect(pose.left.x).toBe(1);
    expect(pose.left.y).toBeCloseTo(-0.5);
  });

  it("maps run status to mood", () => {
    expect(moodForRunStatus("queued")).toBe("thinking");
    expect(moodForRunStatus("leased")).toBe("thinking");
    expect(moodForRunStatus("running")).toBe("working");
    expect(moodForRunStatus("waiting_input")).toBe("listening");
    expect(moodForRunStatus("waiting_takeover")).toBe("listening");
    expect(moodForRunStatus("failed")).toBe("error");
    expect(moodForRunStatus("completed")).toBe("idle");
    expect(moodForRunStatus(undefined)).toBe("idle");
  });

  it("blends poses", () => {
    const a = avatarFacePose(1, "idle", 0);
    const b = avatarFacePose(1, "happy", 0);
    expect(blendAvatarFacePose(a, b, 0)).toEqual(a);
    expect(blendAvatarFacePose(a, b, 1).left.smile).toBeCloseTo(1);
    expect(blendAvatarFacePose(a, b, 0.5).left.smile).toBeCloseTo(0.5);
  });
});

describe("avatar body motion", () => {
  const frames = Array.from({ length: 600 }, (_, i) => (i * 1000) / 60);

  it("moves smoothly in every mood, with no seam or cusp", () => {
    for (const mood of AVATAR_MOODS) {
      for (const seed of [1, 7, 123456]) {
        const poses = frames.map((t) => avatarFacePose(seed, mood, t));
        for (const key of ["bob", "squash", "rotate"] as const) {
          const limit = { bob: 0.06, squash: 0.01, rotate: 1 }[key];
          const accel = { bob: 0.03, squash: 0.005, rotate: 0.5 }[key];
          const values = poses.map((p) => p[key]);
          const deltas = values.slice(1).map((v, i) => v - values[i]!);
          for (const d of deltas) expect(Math.abs(d)).toBeLessThan(limit);
          for (const d of deltas.slice(1).map((v, i) => v - deltas[i]!)) {
            expect(Math.abs(d)).toBeLessThan(accel);
          }
        }
      }
    }
  });

  it("hops: happy rises and returns to the ground each cycle", () => {
    const bobs = frames.map((t) => avatarFacePose(1, "happy", t).bob);
    expect(Math.min(...bobs)).toBeLessThan(-0.4);
    expect(Math.max(...bobs)).toBeLessThanOrEqual(0.0001);
  });

  it("keeps body motion small", () => {
    for (const mood of AVATAR_MOODS) {
      for (const t of frames) {
        const pose = avatarFacePose(3, mood, t);
        expect(Math.abs(pose.rotate)).toBeLessThanOrEqual(12);
        expect(Math.abs(pose.squash)).toBeLessThanOrEqual(0.06);
        expect(Math.abs(pose.bob)).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("avatar eye path", () => {
  const commands = (d: string) => d.replace(/[^A-Za-z]/g, "");

  it("uses the same commands for pill and arc so smile morphs without popping", () => {
    const pill = avatarEyePath(6, 10, { ...eye, smile: 0 });
    const arc = avatarEyePath(6, 10, { ...eye, smile: 1 });
    expect(commands(pill)).toBe("MCCCCCCCCZ");
    expect(commands(arc)).toBe(commands(pill));
    expect(arc).not.toBe(pill);
  });

  it("closes to a visible sliver and rounds to two decimals", () => {
    const d = avatarEyePath(6, 10, { ...eye, open: 0 });
    const ys = [...d.matchAll(/-?\d+(?:\.\d+)? (-?\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]));
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(0);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(1.5);
    expect(d).not.toMatch(/\.\d{3}/);
  });
});

describe("avatarReactionForTransition", () => {
  it("is happy when an active run ends without failing", () => {
    for (const next of ["idle", "completed", undefined])
      expect(avatarReactionForTransition("running", next)).toEqual({ mood: "happy", ms: 1600 });
  });
  it("is sad when an active run fails", () => {
    expect(avatarReactionForTransition("queued", "failed")).toEqual({ mood: "sad", ms: 2000 });
  });
  it("does nothing for cancelled, active-to-active, or non-active starts", () => {
    expect(avatarReactionForTransition("running", "cancelled")).toBeUndefined();
    expect(avatarReactionForTransition("queued", "running")).toBeUndefined();
    expect(avatarReactionForTransition("idle", "completed")).toBeUndefined();
    expect(avatarReactionForTransition(undefined, "idle")).toBeUndefined();
  });
});
