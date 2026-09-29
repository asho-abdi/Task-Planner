"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { createQueryClient } from "@/lib/query-client";
import { applyTheme, useThemeStore } from "@/lib/theme";

function ThemeSync() {
  const hydrate = useThemeStore((state) => state.hydrate);
  const preference = useThemeStore((state) => state.preference);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (preference !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [preference]);

  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => createQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={300} skipDelayDuration={200}>
        <ThemeSync />
        {children}
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
