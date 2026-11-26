"use client";

import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";
import { cn } from "@rakazo/ui-web/lib/utils";
import type * as React from "react";
import { DialogOverlay, DialogPortal } from "./dialog";

/** A panel that slides up from the bottom edge. Escape, a tap outside or Close dismisses it. */
function Sheet({ ...props }: SheetPrimitive.Root.Props) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({ ...props }: SheetPrimitive.Trigger.Props) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({ ...props }: SheetPrimitive.Close.Props) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetContent({ className, children, ...props }: SheetPrimitive.Popup.Props) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <SheetPrimitive.Popup
        data-slot="sheet-content"
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col gap-3 rounded-t-xl bg-popover p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-sm text-popover-foreground ring-1 ring-foreground/10 outline-none overscroll-contain duration-200 data-open:animate-in data-open:slide-in-from-bottom data-closed:animate-out data-closed:slide-out-to-bottom",
          className,
        )}
        {...props}
      >
        {children}
      </SheetPrimitive.Popup>
    </DialogPortal>
  );
}

function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-base leading-none font-medium", className)}
      {...props}
    />
  );
}

// The part of a tall sheet that scrolls, so the title and footer stay in view.
function SheetBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-body"
      className={cn("-mx-1 min-h-0 flex-1 overflow-y-auto overscroll-contain px-1", className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("flex shrink-0 justify-end gap-2", className)}
      {...props}
    />
  );
}

export { Sheet, SheetBody, SheetClose, SheetContent, SheetFooter, SheetTitle, SheetTrigger };
