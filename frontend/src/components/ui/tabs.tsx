"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as React from "react";
import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

/**
 * `variant="line"` renders underline tabs (page-level sections);
 * `variant="pill"` renders a segmented control (view switches).
 */
function TabsList({
  className,
  variant = "line",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & {
  variant?: "line" | "pill";
}) {
  return (
    <TabsPrimitive.List
      data-variant={variant}
      className={cn(
        "group/tabs scrollbar-none inline-flex max-w-full items-center overflow-x-auto",
        variant === "line"
          ? "w-full gap-1 border-b border-border"
          : "h-9 gap-0.5 rounded-lg border border-border bg-muted p-0.5",
        className,
      )}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap text-base font-medium text-muted-foreground transition-colors duration-150",
        "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4",
        // line
        "group-data-[variant=line]/tabs:relative group-data-[variant=line]/tabs:h-10 group-data-[variant=line]/tabs:px-2.5",
        "group-data-[variant=line]/tabs:after:absolute group-data-[variant=line]/tabs:after:inset-x-1.5 group-data-[variant=line]/tabs:after:-bottom-px group-data-[variant=line]/tabs:after:h-0.5 group-data-[variant=line]/tabs:after:rounded-full group-data-[variant=line]/tabs:after:bg-transparent group-data-[variant=line]/tabs:after:transition-colors",
        "group-data-[variant=line]/tabs:data-[state=active]:text-foreground group-data-[variant=line]/tabs:data-[state=active]:after:bg-primary",
        // pill
        "group-data-[variant=pill]/tabs:h-full group-data-[variant=pill]/tabs:rounded-md group-data-[variant=pill]/tabs:px-2.5 group-data-[variant=pill]/tabs:text-sm",
        "group-data-[variant=pill]/tabs:data-[state=active]:bg-card group-data-[variant=pill]/tabs:data-[state=active]:text-foreground group-data-[variant=pill]/tabs:data-[state=active]:shadow-xs",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn(
        "mt-5 focus-visible:outline-none data-[state=active]:animate-fade-in",
        className,
      )}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
