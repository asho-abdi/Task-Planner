import { create } from "zustand";

export type CreateDialogType =
  | "workspace"
  | "task"
  | "project"
  | "meeting"
  | "todo"
  | "goal";

type UiStore = {
  openCreateDialog: CreateDialogType | null;
  createTaskProjectId: string | null;
  createMeetingProjectId: string | null;
  sidebarCollapsed: boolean;
  mobileNavOpen: boolean;
  setOpenCreateDialog: (type: CreateDialogType | null) => void;
  openTaskCreate: (projectId?: string | null) => void;
  openMeetingCreate: (projectId?: string | null) => void;
  toggleSidebarCollapsed: () => void;
  setMobileNavOpen: (open: boolean) => void;
};

export const useUiStore = create<UiStore>((set) => ({
  openCreateDialog: null,
  createTaskProjectId: null,
  createMeetingProjectId: null,
  sidebarCollapsed: false,
  mobileNavOpen: false,
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
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setMobileNavOpen: (open: boolean) => set({ mobileNavOpen: open }),
}));
