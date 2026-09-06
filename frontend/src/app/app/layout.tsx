import type { ReactNode } from "react";
import { AuthGate } from "@/components/layout/auth-gate";

export default function AppSectionLayout({ children }: { children: ReactNode }) {
  return <AuthGate>{children}</AuthGate>;
}
