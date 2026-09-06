"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { WorkspaceChat } from "@/features/chat/chat-ui";
import { Skeleton } from "@/components/ui/skeleton";

function ChatPageInner() {
  const search = useSearchParams();
  return <WorkspaceChat selectedId={search.get("c")} />;
}

export default function ChatPage() {
  return (
    <Suspense fallback={<Skeleton className="h-80 w-full" />}>
      <ChatPageInner />
    </Suspense>
  );
}
