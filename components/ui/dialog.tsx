"use client";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
export const Dialog = DialogPrimitive.Root;
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;
export function DialogContent({
  children,
  className = "",
  onCloseAutoFocus,
}: {
  children: React.ReactNode;
  className?: string;
  onCloseAutoFocus?: (event: Event) => void;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="dialog-overlay" />
      <DialogPrimitive.Content
        onCloseAutoFocus={onCloseAutoFocus}
        className={"dialog-content " + className}
      >
        {children}
        <DialogPrimitive.Close
          className="dialog-close"
          aria-label="Close panel"
        >
          <X size={18} />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
