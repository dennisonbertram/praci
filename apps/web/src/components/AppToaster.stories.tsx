import { enqueueNotificationToast } from "@rakazo/ui-web";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect } from "react";
import { AppToaster } from "./AppToaster";

function Demo() {
  useEffect(() => {
    enqueueNotificationToast({
      id: "demo",
      title: "Weekly digest is ready",
      body: "Three new items.",
    });
  }, []);
  // The toast renders in a portal, so the page needs content of its own to show.
  return (
    <div className="p-4 text-sm">
      Page content
      <AppToaster />
    </div>
  );
}

const meta = { title: "App/AppToaster", component: AppToaster } satisfies Meta<typeof AppToaster>;
export default meta;
export const WithToast: StoryObj<typeof meta> = { render: () => <Demo /> };
