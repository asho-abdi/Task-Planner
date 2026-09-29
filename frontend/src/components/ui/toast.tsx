"use client";

import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { Toaster as Sonner, toast } from "sonner";
import { useThemeStore, resolvedTheme } from "@/lib/theme";
import { Spinner } from "@/components/ui/spinner";

/** App-wide toast outlet. Use `toast.success("Saved")` anywhere. */
function Toaster() {
  const preference = useThemeStore((state) => state.preference);
  return (
    <Sonner
      theme={resolvedTheme(preference)}
      position="bottom-right"
      closeButton
      gap={8}
      icons={{
        success: <CircleCheck className="size-4 text-success" />,
        error: <CircleAlert className="size-4 text-danger" />,
        warning: <TriangleAlert className="size-4 text-warning" />,
        info: <Info className="size-4 text-info" />,
        loading: <Spinner className="text-muted-foreground" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "!rounded-lg !border !border-border !bg-popover !text-popover-foreground !shadow-lg !font-sans !text-base !gap-2.5 !px-3.5 !py-3",
          title: "!font-medium",
          description: "!text-sm !text-muted-foreground",
          actionButton: "!bg-primary !text-primary-foreground !rounded-md !font-medium",
          cancelButton: "!bg-muted !text-foreground !rounded-md",
          closeButton:
            "!bg-popover !border-border !text-muted-foreground hover:!text-foreground",
        },
      }}
    />
  );
}

export { Toaster, toast };
