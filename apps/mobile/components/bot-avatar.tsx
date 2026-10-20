import type { AvatarStyle } from "@rakazo/contracts";
import type { AvatarMood } from "@rakazo/core";
import {
  ACTIVE_RUN_STATUSES,
  AVATAR_GAZE_TRAVEL,
  avatarIdentitySeed,
  avatarReactionForTransition,
  avatarRest,
  avatarShapeGazeTravel,
  moodForRunStatus,
  organicAvatarPath,
  SHIPPED_BOT_AVATAR_CENTER,
  SHIPPED_BOT_AVATAR_VIEWBOX,
} from "@rakazo/core";
import { memo, useEffect, useMemo, useRef } from "react";
import { Image, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { G, Path } from "react-native-svg";
import type { AvatarFaceGeometry } from "../lib/avatar-face";
import { robotFaceLayout } from "../lib/avatar-face";
import { workingAvatarDuration, workingAvatarFrame } from "../lib/avatar-motion";
import { mobileBotAvatarPresentation } from "../lib/bot-avatar";
import { useI18n } from "../lib/i18n";
import { useAvatarStyle } from "./avatar-style";
import { NativeSymbol } from "./native-symbol";
import { useAvatarFace, useAvatarReaction } from "./use-avatar-face";

export { useAvatarReaction };

const AnimatedPath = Animated.createAnimatedComponent(Path);

type Look = { x: number; y: number };

export const BotAvatar = memo(function BotAvatar({
  color,
  size = 54,
  status,
  identity,
  variant,
  muted = false,
  mood: moodProp,
  lookAt,
}: {
  color: string;
  size?: number;
  status?: string;
  identity?: string;
  variant?: AvatarStyle;
  muted?: boolean;
  /** Overrides the mood derived from `status`. */
  mood?: AvatarMood;
  /** Gaze target, -1..1 on each axis. */
  lookAt?: Look;
}) {
  const { t } = useI18n();
  const isWorking = ACTIVE_RUN_STATUSES.some((activeStatus) => activeStatus === status);
  const [reaction, react] = useAvatarReaction();
  const previousStatus = useRef(status);
  useEffect(() => {
    const was = previousStatus.current;
    previousStatus.current = status;
    const next = avatarReactionForTransition(was, status);
    if (next) react(next.mood, next.ms);
  }, [status, react]);
  const mood = moodProp ?? reaction ?? moodForRunStatus(status);
  const { avatarStyle } = useAvatarStyle();
  const parsed = mobileBotAvatarPresentation(color);
  const fillColor = parsed.kind === "shape" || parsed.kind === "color" ? parsed.color : color;
  const picture =
    parsed.kind === "image" && parsed.imageUrl ? (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: "hidden",
        }}
      >
        <Image source={{ uri: parsed.imageUrl }} style={{ width: size, height: size }} />
      </View>
    ) : parsed.kind === "shape" ? (
      <ShippedShapeAvatar
        color={parsed.color}
        shapeIndex={parsed.shapeIndex}
        shapePath={parsed.shapePath}
        size={size}
        identity={identity || fillColor}
        mood={mood}
        lookAt={lookAt}
      />
    ) : (variant ?? avatarStyle) === "organic" ? (
      <OrganicAvatar
        color={fillColor}
        identity={identity}
        size={size}
        isWorking={isWorking}
        mood={mood}
        lookAt={lookAt}
      />
    ) : (
      <RobotAvatar
        color={fillColor}
        identity={identity || fillColor}
        size={size}
        mood={mood}
        lookAt={lookAt}
      />
    );
  return (
    <View style={{ width: size, height: size }}>
      {picture}
      {isWorking ? (
        <View
          accessibilityLabel={t("Working")}
          style={{
            position: "absolute",
            right: muted ? undefined : 0,
            left: muted ? 0 : undefined,
            bottom: 0,
            width: Math.max(6, Math.round(size * 0.18)),
            height: Math.max(6, Math.round(size * 0.18)),
            borderRadius: size,
            backgroundColor: "#F5A03C",
          }}
        />
      ) : null}
      {muted ? (
        <View
          accessible
          accessibilityLabel={t("Notifications silenced")}
          style={{
            position: "absolute",
            right: -2,
            bottom: -2,
            width: Math.max(14, Math.round(size * 0.34)),
            height: Math.max(14, Math.round(size * 0.34)),
            borderRadius: size,
            borderWidth: 2,
            borderColor: "#000",
            backgroundColor: "#242428",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <NativeSymbol
            ios="bell.slash.fill"
            android="notifications-off"
            size={Math.max(8, Math.round(size * 0.17))}
            color="#ECECEE"
          />
        </View>
      ) : null}
    </View>
  );
});

const SHAPE_VIEWBOX_SIZE = 259;
const SHAPE_EYE = { w: 20, h: 62, dx: 34, dy: 12 };

function ShippedShapeAvatar({
  color,
  shapeIndex,
  shapePath,
  size,
  identity,
  mood,
  lookAt,
}: {
  color: string;
  shapeIndex: number;
  shapePath: string;
  size: number;
  identity: string;
  mood: AvatarMood;
  lookAt?: Look;
}) {
  const center = SHIPPED_BOT_AVATAR_CENTER;
  const seed = avatarIdentitySeed(identity);
  const geometry = useMemo<AvatarFaceGeometry>(
    () => ({
      eyes: [
        { cx: center - SHAPE_EYE.dx, cy: center + SHAPE_EYE.dy },
        { cx: center + SHAPE_EYE.dx, cy: center + SHAPE_EYE.dy },
      ],
      w: SHAPE_EYE.w,
      h: SHAPE_EYE.h,
      travelX: avatarShapeGazeTravel(shapeIndex).x,
      travelY: avatarShapeGazeTravel(shapeIndex).y,
      rest: avatarRest(seed),
      bob: 20,
    }),
    [center, seed, shapeIndex],
  );
  const face = useAvatarFace({ seed, mood, size, geometry, lookAt });
  const bodyStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: (face.frame.value.bodyY * size) / SHAPE_VIEWBOX_SIZE },
      { rotate: `${face.frame.value.bodyRotate}deg` },
      { scaleX: face.frame.value.bodyScaleX },
      { scaleY: face.frame.value.bodyScaleY },
    ],
  }));
  return (
    <Animated.View style={[{ width: size, height: size }, bodyStyle]}>
      <Svg width={size} height={size} viewBox={SHIPPED_BOT_AVATAR_VIEWBOX}>
        <Path d={shapePath} fill={color} />
        <G fill="#101014">
          <AnimatedPath animatedProps={face.leftProps} d={face.initial.leftD} />
          <AnimatedPath animatedProps={face.rightProps} d={face.initial.rightD} />
        </G>
      </Svg>
    </Animated.View>
  );
}

function RobotAvatar({
  color,
  identity,
  size,
  mood,
  lookAt,
}: {
  color: string;
  identity: string;
  size: number;
  mood: AvatarMood;
  lookAt?: Look;
}) {
  const seed = avatarIdentitySeed(identity);
  const { visorW, visorH, innerW, innerH, eyeW, eyeH, eyeGap } = robotFaceLayout(size);
  const geometry = useMemo<AvatarFaceGeometry>(() => {
    const cx = innerW / 2;
    const cy = innerH / 2;
    return {
      eyes: [
        { cx: cx - (eyeGap + eyeW) / 2, cy },
        { cx: cx + (eyeGap + eyeW) / 2, cy },
      ],
      w: eyeW,
      h: eyeH,
      travelX: Math.max(0, (innerW - eyeW * 2 - eyeGap) / 2) * AVATAR_GAZE_TRAVEL.robot.x,
      travelY: Math.max(0, (innerH - eyeH) / 2) * AVATAR_GAZE_TRAVEL.robot.y,
    };
  }, [innerW, innerH, eyeW, eyeH, eyeGap]);
  const face = useAvatarFace({ seed, mood, size, geometry, lookAt });
  const visorStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${face.frame.value.bodyRotate * 0.6}deg` }],
  }));
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Animated.View
        style={[
          {
            width: visorW,
            height: visorH,
            borderRadius: Math.round(visorH * 0.52),
            backgroundColor: "#0C0C0E",
            overflow: "hidden",
          },
          visorStyle,
        ]}
      >
        <Svg width={visorW} height={visorH} viewBox={`0 0 ${innerW} ${innerH}`}>
          <G fill="#fff">
            <AnimatedPath animatedProps={face.leftProps} d={face.initial.leftD} />
            <AnimatedPath animatedProps={face.rightProps} d={face.initial.rightD} />
          </G>
        </Svg>
      </Animated.View>
    </View>
  );
}

const ORGANIC_EYE = { w: 7, h: 24, dx: 10.5 };

function OrganicAvatar({
  color,
  identity,
  size,
  isWorking,
  mood,
  lookAt,
}: {
  color: string;
  identity?: string;
  size: number;
  isWorking: boolean;
  mood: AvatarMood;
  lookAt?: Look;
}) {
  const seed = avatarIdentitySeed(identity || color || "#8B5CF6");
  const progress = useSharedValue(0);
  const reducedMotion = useReducedMotion();
  const geometry = useMemo<AvatarFaceGeometry>(
    () => ({
      eyes: [
        { cx: -ORGANIC_EYE.dx, cy: 0 },
        { cx: ORGANIC_EYE.dx, cy: 0 },
      ],
      w: ORGANIC_EYE.w,
      h: ORGANIC_EYE.h,
      travelX: AVATAR_GAZE_TRAVEL.organic.x,
      travelY: AVATAR_GAZE_TRAVEL.organic.y,
      rest: avatarRest(seed),
      bob: 10,
    }),
    [seed],
  );
  const face = useAvatarFace({ seed, mood, size, geometry, lookAt });

  useEffect(() => {
    cancelAnimation(progress);
    progress.value = 0;
    if (isWorking && !reducedMotion) {
      progress.value = withRepeat(
        withTiming(1, {
          duration: workingAvatarDuration(seed),
          easing: Easing.linear,
        }),
        -1,
      );
    }
    return () => cancelAnimation(progress);
  }, [isWorking, progress, reducedMotion, seed]);

  const bodyStyle = useAnimatedStyle(() => {
    const working = workingAvatarFrame(seed, progress.value);
    const unit = size / 120;
    // The working choreography already moves the body; the face engine only adds idle motion.
    const engine = isWorking ? 0 : 1;
    return {
      transform: [
        { translateX: working.translationX * unit },
        { translateY: working.translationY * unit + face.frame.value.bodyY * unit * engine },
        { rotate: `${working.rotation + face.frame.value.bodyRotate * engine}deg` },
        { scaleX: working.scaleX * (1 + (face.frame.value.bodyScaleX - 1) * engine) },
        { scaleY: working.scaleY * (1 + (face.frame.value.bodyScaleY - 1) * engine) },
      ],
    };
  });

  return (
    <View style={{ width: size, height: size }}>
      <Animated.View style={[{ width: size, height: size }, bodyStyle]}>
        <Svg width={size} height={size} viewBox="-60 -60 120 120">
          <Path d={organicAvatarPath(seed)} fill={color} />
          <G transform={`rotate(${(seed % 9) - 4})`} fill="#101014">
            <AnimatedPath animatedProps={face.leftProps} d={face.initial.leftD} />
            <AnimatedPath animatedProps={face.rightProps} d={face.initial.rightD} />
          </G>
        </Svg>
      </Animated.View>
    </View>
  );
}
