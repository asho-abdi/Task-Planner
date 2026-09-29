"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { WorkspaceChat } from "@/features/chat/chat-ui";
import { Skeleton } from "@/components/ui/skeleton";

function ChatPageInner() {
  const search = useSearchParams();
  return <WorkspaceChat selectedId={search.get("c")} />;
}

function ChatFallback() {
  return (
    <div
      className="-mx-4 -mb-10 -mt-6 flex h-[calc(100svh-56px)] overflow-hidden bg-card sm:-mx-6 lg:-mx-8"
      role="status"
      aria-label="Loading chat"
    >
      <div className="hidden w-64 shrink-0 space-y-3 border-r border-border bg-muted/50 p-4 md:block lg:w-72">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-8 w-full" />
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-6 w-full" />
        ))}
      </div>
      <div className="flex flex-1 flex-col">
        <div className="flex h-14 items-center gap-3 border-b border-border px-4">
          <Skeleton className="size-8 rounded-md" />
          <Skeleton className="h-3 w-32" />
        </div>
        <div className="flex-1" />
        <div className="p-4">
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<ChatFallback />}>
      <ChatPageInner />
    </Suspense>
  );
}
