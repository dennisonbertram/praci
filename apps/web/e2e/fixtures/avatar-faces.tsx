import "../../src/styles.css";
import { AVATAR_MOODS, BotAvatar } from "@rakazo/ui-web";
import { freezeAvatarTicker } from "@rakazo/ui-web/avatar-ticker";
import { createRoot } from "react-dom/client";

// ?t=<ms> renders every avatar at that time and stops animating.
const frozen = new URLSearchParams(location.search).get("t");
if (frozen !== null) freezeAvatarTicker(Number(frozen));

const color = "#8B5CF6";
const rows = [
  { label: "robot maya", variant: "robot", identity: "maya", color },
  { label: "robot github", variant: "robot", identity: "github", color: "#10B981" },
  ...["maya", "github", "atlas", "nova", "iris", "pixel"].map((identity) => ({
    label: `organic ${identity}`,
    variant: "organic" as const,
    identity,
    color: "#F97316",
  })),
  ...Array.from({ length: 8 }, (_, i) => ({
    label: `shape ${i}`,
    variant: "robot" as const,
    identity: `shape-${i}`,
    color: `#3B82F6::shape_${i}`,
  })),
];

createRoot(document.getElementById("root")!).render(
  <>
    <span />
    {AVATAR_MOODS.map((mood) => (
      <span key={mood} className="heading">
        {mood}
      </span>
    ))}
    {rows.map((row) => (
      <Row key={row.label} {...row} />
    ))}
    <span className="label">sizes</span>
    <div className="sizes">
      {[16, 24, 36, 54].map((size) => (
        <BotAvatar
          key={size}
          color={color}
          identity="maya"
          size={size}
          variant="robot"
          className="size-example"
        />
      ))}
      {[16, 24, 36, 54].map((size) => (
        <BotAvatar
          key={size}
          color="#F97316"
          identity="maya"
          size={size}
          variant="organic"
          className="size-example"
        />
      ))}
    </div>
  </>,
);

function Row(props: {
  label: string;
  variant: "robot" | "organic";
  identity: string;
  color: string;
}) {
  return (
    <>
      <span className="label">{props.label}</span>
      {AVATAR_MOODS.map((mood) => (
        <BotAvatar
          key={mood}
          color={props.color}
          identity={props.identity}
          variant={props.variant}
          size={72}
          mood={mood}
        />
      ))}
    </>
  );
}
