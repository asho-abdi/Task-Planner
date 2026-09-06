import { create } from "zustand";
import { setCurrentWorkspaceId as setSessionWorkspaceId } from "@/lib/session";

const STORAGE_KEY = "currentWorkspaceId";

function readStoredWorkspaceId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  const id = localStorage.getItem(STORAGE_KEY);
  if (id) {
    setSessionWorkspaceId(id);
  }
  return id;
}

type WorkspaceStore = {
  currentWorkspaceId: string | null;
  setCurrentWorkspaceId: (id: string | null) => void;
  hydrate: () => void;
};

export const useWorkspaceStore = create<WorkspaceStore>((set) => ({
  currentWorkspaceId: readStoredWorkspaceId(),
  setCurrentWorkspaceId: (id) => {
    setSessionWorkspaceId(id);
    if (typeof window !== "undefined") {
      if (id) {
        localStorage.setItem(STORAGE_KEY, id);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    set({ currentWorkspaceId: id });
  },
  hydrate: () => {
    if (typeof window === "undefined") {
      return;
    }
    const id = localStorage.getItem(STORAGE_KEY);
    if (id) {
      setSessionWorkspaceId(id);
      set({ currentWorkspaceId: id });
    }
  },
}));
