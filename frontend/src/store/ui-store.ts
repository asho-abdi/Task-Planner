import { create } from "zustand";

export type CreateDialogType =
  | "workspace"
  | "task"
  | "project"
  | "meeting"
  | "todo"
  | "goal";

const SIDEBAR_KEY = "sidebarCollapsed";

function persistSidebar(collapsed: boolean) {
  try {
    localStorage.setItem(SIDEBAR_KEY, collapsed ? "1" : "0");
  } catch {
    // Non-critical preference; ignore unavailable storage.
  }
}

type UiStore = {
  openCreateDialog: CreateDialogType | null;
  createTaskProjectId: string | null;
  createMeetingProjectId: string | null;
  sidebarCollapsed: boolean;
  mobileNavOpen: boolean;
  commandOpen: boolean;
  setOpenCreateDialog: (type: CreateDialogType | null) => void;
  openTaskCreate: (projectId?: string | null) => void;
  openMeetingCreate: (projectId?: string | null) => void;
  toggleSidebarCollapsed: () => void;
  hydrateSidebar: () => void;
  setMobileNavOpen: (open: boolean) => void;
  setCommandOpen: (open: boolean) => void;
};

export const useUiStore = create<UiStore>((set) => ({
  openCreateDialog: null,
  createTaskProjectId: null,
  createMeetingProjectId: null,
  sidebarCollapsed: false,
  mobileNavOpen: false,
  commandOpen: false,
  setOpenCreateDialog: (type) =>
    set((state) => ({
      openCreateDialog: type,
      createTaskProjectId: type === "task" ? state.createTaskProjectId : null,
      createMeetingProjectId:
        type === "meeting" ? state.createMeetingProjectId : null,
    })),
  openTaskCreate: (projectId) =>
    set({
      openCreateDialog: "task",
      createTaskProjectId: projectId ?? null,
    }),
  openMeetingCreate: (projectId) =>
    set({
      openCreateDialog: "meeting",
      createMeetingProjectId: projectId ?? null,
    }),
  toggleSidebarCollapsed: () =>
    set((state) => {
      persistSidebar(!state.sidebarCollapsed);
      return { sidebarCollapsed: !state.sidebarCollapsed };
    }),
  hydrateSidebar: () => {
    try {
      set({ sidebarCollapsed: localStorage.getItem(SIDEBAR_KEY) === "1" });
    } catch {
      // Keep default.
    }
  },
  setMobileNavOpen: (open: boolean) => set({ mobileNavOpen: open }),
  setCommandOpen: (open: boolean) => set({ commandOpen: open }),
}));
