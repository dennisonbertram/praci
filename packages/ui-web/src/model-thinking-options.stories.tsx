import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { ModelThinkingOptions } from "./model-thinking-options";

type Props = Parameters<typeof ModelThinkingOptions>[0];

const levels = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

/** Holds the values the way a settings form does, so the controls respond. */
function Form(initial: Partial<Props>) {
  const [reasoning, setReasoning] = useState(initial.reasoning ?? false);
  const [level, setLevel] = useState<string | null>(initial.thinkingLevel ?? null);
  const [images, setImages] = useState(initial.supportsImages ?? false);
  const [maxTokens, setMaxTokens] = useState(initial.maxTokens ?? "");
  const [context, setContext] = useState(initial.contextWindow ?? "");
  const [maxImages, setMaxImages] = useState(initial.maxImagesPerPrompt ?? "");
  return (
    <div className="w-80">
      <ModelThinkingOptions
        advancedLabel="Advanced"
        thinkingLabel="Thinks before answering"
        thinkingLevelLabel="Thinking level"
        thinkingLevelDefaultLabel="Default"
        thinkingLevelOptions={levels}
        maxTokensLabel="Max output tokens"
        contextWindowLabel="Context window"
        imagesLabel="Accepts images"
        maxImagesLabel="Max images per prompt"
        {...initial}
        reasoning={reasoning}
        onReasoningChange={setReasoning}
        thinkingLevel={level}
        onThinkingLevelChange={setLevel}
        supportsImages={images}
        onSupportsImagesChange={setImages}
        maxTokens={maxTokens}
        onMaxTokensChange={setMaxTokens}
        contextWindow={context}
        onContextWindowChange={setContext}
        maxImagesPerPrompt={maxImages}
        onMaxImagesPerPromptChange={setMaxImages}
      />
    </div>
  );
}

const meta = {
  title: "UI/ModelThinkingOptions",
  component: ModelThinkingOptions,
  render: (args) => <Form {...args} />,
  args: { advancedLabel: "Advanced" },
} satisfies Meta<typeof ModelThinkingOptions>;
export default meta;
type Story = StoryObj<typeof meta>;

const open = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  await userEvent.click(within(canvasElement).getByText("Advanced"));
};

export const Closed: Story = {};

export const Open: Story = { play: open };

export const ReasoningWithLevel: Story = {
  args: { reasoning: true, thinkingLevel: "medium", maxTokens: "4096", contextWindow: "128000" },
  play: open,
};

export const WithImages: Story = {
  args: { supportsImages: true, maxImagesPerPrompt: "10" },
  play: open,
};

export const ThinkingHidden: Story = { args: { showThinking: false }, play: open };

export const Disabled: Story = {
  args: { disabled: true, reasoning: true, supportsImages: true },
  play: open,
};

export const Toggling: Story = {
  play: async (context) => {
    await open(context);
    await userEvent.click(within(context.canvasElement).getAllByRole("checkbox")[0] as HTMLElement);
    await expect(within(context.canvasElement).getByLabelText("Thinking level")).toBeTruthy();
  },
};
