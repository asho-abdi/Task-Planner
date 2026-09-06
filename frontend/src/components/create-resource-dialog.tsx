"use client";

import { useEffect, useRef, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type CreateResourceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export function CreateResourceDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: CreateResourceDialogProps) {
  const ignoreOutsideUntil = useRef(0);

  useEffect(() => {
    if (open) {
      ignoreOutsideUntil.current = Date.now() + 400;
    }
  }, [open]);

  function preventOpeningClick(event: { preventDefault: () => void }) {
    if (Date.now() < ignoreOutsideUntil.current) {
      event.preventDefault();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={className}
        onPointerDownOutside={preventOpeningClick}
        onInteractOutside={preventOpeningClick}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>
        {children}
        {footer ? <DialogFooter>{footer}</DialogFooter> : null}
      </DialogContent>
    </Dialog>
  );
}
