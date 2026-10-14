import { avatarEyePath, avatarFacePose } from "@rakazo/core";
import { describe, expect, it } from "vitest";
import { faceFrame, reactionForTransition, robotFaceLayout, transformEyePath } from "./avatar-face";

const pose = avatarFacePose(3, "idle", 0);

describe("avatar face geometry", () => {
  it("translates and rotates every point of an eye path", () => {
    const d = avatarEyePath(10, 20, pose.left);
    expect(transformEyePath(d, 0, 0, 0)).toBe(d);
    const moved = transformEyePath(d, 5, -3, 0);
    const a = d.match(/-?\d*\.?\d+/g)?.map(Number) ?? [];
    const b = moved.match(/-?\d*\.?\d+/g)?.map(Number) ?? [];
    expect(b).toHaveLength(a.length);
    expect(b[0]).toBeCloseTo((a[0] ?? 0) + 5, 1);
    expect(b[1]).toBeCloseTo((a[1] ?? 0) - 3, 1);
    expect(moved.startsWith("M")).toBe(true);
    expect(moved.endsWith("Z")).toBe(true);
    expect(moved.match(/C/g)).toHaveLength(8);
    const rotated = transformEyePath("M10 0C10 0 10 0 10 0Z", 0, 0, 90);
    expect(rotated).toBe("M0 10C0 10 0 10 0 10Z");
  });

  it("applies rest offset and lean from the geometry", () => {
    const g = {
      eyes: [
        { cx: -10, cy: 0 },
        { cx: 10, cy: 0 },
      ],
      w: 7,
      h: 24,
      travelX: 4,
      travelY: 3,
      bob: 4,
    } as const;
    const plain = faceFrame(pose, g);
    const leaning = faceFrame(pose, { ...g, rest: { x: 0.5, y: 0, lean: 17 } });
    expect(leaning.leftD).not.toBe(plain.leftD);
    expect(plain.bodyScaleY).toBeCloseTo(1 + pose.squash);
    expect(plain.bodyY).toBeCloseTo(pose.bob * 4);
    expect(faceFrame(pose, { ...g, bob: undefined }).bodyY).toBeCloseTo(0);
  });

  it("sizes robot eyes to fit the visor", () => {
    for (const size of [12, 24, 36, 54, 96]) {
      const l = robotFaceLayout(size);
      expect(l.eyeW * 2 + l.eyeGap).toBeLessThanOrEqual(l.innerW);
      expect(l.eyeH).toBeLessThanOrEqual(l.innerH);
    }
  });
});

describe("avatar reactions", () => {
  it("reacts only when an active run ends", () => {
    expect(reactionForTransition(true, "completed")).toEqual({ mood: "happy", ms: 1600 });
    expect(reactionForTransition(true, "failed")).toEqual({ mood: "sad", ms: 2000 });
    expect(reactionForTransition(true, "cancelled")).toBeUndefined();
    expect(reactionForTransition(false, "completed")).toBeUndefined();
  });
});
