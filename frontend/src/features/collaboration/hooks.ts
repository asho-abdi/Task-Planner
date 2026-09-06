"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@/features/collaboration/api";
import { updateTaskStatus } from "@/features/tasks/api";
import { taskKeys } from "@/features/tasks/hooks";
import { insightKeys } from "@/features/insights/hooks";
import { projectKeys } from "@/features/projects/hooks";
import type { FileAttach } from "@/features/collaboration/types";
import { useWorkspaceStore } from "@/store/workspace-store";

export const collabKeys = {
  notifications: (workspaceId: string) =>
    ["notifications", workspaceId] as const,
  teams: (workspaceId: string) => ["teams", workspaceId] as const,
  files: (workspaceId: string, query: object) =>
    ["files", workspaceId, query] as const,
  pages: (workspaceId: string) => ["pages", workspaceId] as const,
  page: (workspaceId: string, pageId: string) =>
    ["pages", workspaceId, pageId] as const,
  comments: (workspaceId: string, taskId: string) =>
    ["comments", workspaceId, taskId] as const,
  subtasks: (workspaceId: string, taskId: string) =>
    ["subtasks", workspaceId, taskId] as const,
  assignments: (workspaceId: string, projectId: string) =>
    ["assignments", workspaceId, projectId] as const,
  users: ["platform-users"] as const,
};

export function useNotifications(workspaceId: string | null) {
  return useQuery({
    queryKey: collabKeys.notifications(workspaceId ?? "none"),
    queryFn: api.listNotifications,
    enabled: Boolean(workspaceId),
    staleTime: 15_000,
    refetchInterval: 45_000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  return useMutation({
    mutationFn: api.markNotificationRead,
    onSuccess: () => {
      if (workspaceId) {
        void queryClient.invalidateQueries({
          queryKey: collabKeys.notifications(workspaceId),
        });
      }
    },
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  return useMutation({
    mutationFn: api.markAllNotificationsRead,
    onSuccess: () => {
      if (workspaceId) {
        void queryClient.invalidateQueries({
          queryKey: collabKeys.notifications(workspaceId),
        });
      }
    },
  });
}

export function useUpdateNotificationPrefs() {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  return useMutation({
    mutationFn: api.updateNotificationPrefs,
    onSuccess: () => {
      if (workspaceId) {
        void queryClient.invalidateQueries({
          queryKey: collabKeys.notifications(workspaceId),
        });
      }
    },
  });
}

export function useTeams(workspaceId: string | null) {
  return useQuery({
    queryKey: collabKeys.teams(workspaceId ?? "none"),
    queryFn: api.listTeams,
    enabled: Boolean(workspaceId),
    staleTime: 60_000,
  });
}

export function useCreateTeam() {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  return useMutation({
    mutationFn: api.createTeam,
    onSuccess: () => {
      if (workspaceId) {
        void queryClient.invalidateQueries({
          queryKey: collabKeys.teams(workspaceId),
        });
      }
    },
  });
}

export function useFiles(
  workspaceId: string | null,
  query: FileAttach = {},
) {
  return useQuery({
    queryKey: collabKeys.files(workspaceId ?? "none", query),
    queryFn: () => api.listFiles(query),
    enabled: Boolean(workspaceId),
    staleTime: 30_000,
  });
}

export function useUploadFile() {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  return useMutation({
    mutationFn: ({
      file,
      attach,
    }: {
      file: File;
      attach?: FileAttach;
    }) => api.uploadFile(file, attach),
    onSuccess: () => {
      if (workspaceId) {
        void queryClient.invalidateQueries({ queryKey: ["files", workspaceId] });
      }
    },
  });
}

export function useRenameFile() {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  return useMutation({
    mutationFn: (input: { fileId: string; originalName: string }) =>
      api.renameFile(input.fileId, input.originalName),
    onSuccess: () => {
      if (workspaceId) {
        void queryClient.invalidateQueries({ queryKey: ["files", workspaceId] });
      }
    },
  });
}

export function useMoveFile() {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  return useMutation({
    mutationFn: (input: { fileId: string; attach: FileAttach }) =>
      api.moveFile(input.fileId, input.attach),
    onSuccess: () => {
      if (workspaceId) {
        void queryClient.invalidateQueries({ queryKey: ["files", workspaceId] });
      }
    },
  });
}

export function usePages(workspaceId: string | null) {
  return useQuery({
    queryKey: collabKeys.pages(workspaceId ?? "none"),
    queryFn: api.listPages,
    enabled: Boolean(workspaceId),
    staleTime: 30_000,
  });
}

export function usePage(workspaceId: string | null, pageId: string) {
  return useQuery({
    queryKey: collabKeys.page(workspaceId ?? "none", pageId),
    queryFn: () => api.getPage(pageId),
    enabled: Boolean(workspaceId) && Boolean(pageId),
  });
}

export function useCreatePage() {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  return useMutation({
    mutationFn: api.createPage,
    onSuccess: () => {
      if (workspaceId) {
        void queryClient.invalidateQueries({
          queryKey: collabKeys.pages(workspaceId),
        });
      }
    },
  });
}

export function useUpdatePage(pageId: string) {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  return useMutation({
    mutationFn: (input: { title?: string; body?: string }) =>
      api.updatePage(pageId, input),
    onSuccess: () => {
      if (workspaceId) {
        void queryClient.invalidateQueries({
          queryKey: collabKeys.pages(workspaceId),
        });
        void queryClient.invalidateQueries({
          queryKey: collabKeys.page(workspaceId, pageId),
        });
      }
    },
  });
}

export function useComments(workspaceId: string | null, taskId: string) {
  return useQuery({
    queryKey: collabKeys.comments(workspaceId ?? "none", taskId),
    queryFn: () => api.listComments(taskId),
    enabled: Boolean(workspaceId) && Boolean(taskId),
  });
}

export function useAddComment(taskId: string) {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  return useMutation({
    mutationFn: (input: { body: string; parentId?: string }) =>
      api.addComment(taskId, input.body, input.parentId),
    onSuccess: () => {
      if (workspaceId) {
        void queryClient.invalidateQueries({
          queryKey: collabKeys.comments(workspaceId, taskId),
        });
        void queryClient.invalidateQueries({ queryKey: ["files", workspaceId] });
      }
    },
  });
}

export function useReactToComment(taskId: string) {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  return useMutation({
    mutationFn: (input: { commentId: string; emoji: string }) =>
      api.reactToComment(taskId, input.commentId, input.emoji),
    onSuccess: () => {
      if (workspaceId) {
        void queryClient.invalidateQueries({
          queryKey: collabKeys.comments(workspaceId, taskId),
        });
      }
    },
  });
}

export function useSubtasks(workspaceId: string | null, taskId: string) {
  return useQuery({
    queryKey: collabKeys.subtasks(workspaceId ?? "none", taskId),
    queryFn: () => api.listSubtasks(taskId),
    enabled: Boolean(workspaceId) && Boolean(taskId),
  });
}

export function useTaskWorkflow(taskId: string) {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const invalidate = () => {
    if (!workspaceId) return;
    void queryClient.invalidateQueries({ queryKey: taskKeys.all(workspaceId) });
    void queryClient.invalidateQueries({ queryKey: insightKeys.all(workspaceId) });
  };
  return {
    startWork: useMutation({
      mutationFn: () => updateTaskStatus(taskId, "IN_PROGRESS"),
      onSuccess: invalidate,
    }),
    submit: useMutation({
      mutationFn: (input: {
        fileIds?: string[];
        note?: string;
        deliverables?: string;
        justification?: string;
      }) => api.submitTask(taskId, input),
      onSuccess: invalidate,
    }),
    review: useMutation({
      mutationFn: (input: {
        status: "APPROVED" | "RETURNED";
        note?: string;
        submissionId?: string;
      }) =>
        api.reviewTask(taskId, input.status, input.note, input.submissionId),
      onSuccess: (task) => {
        if (workspaceId && task && typeof task === "object" && "id" in task) {
          queryClient.setQueryData(
            taskKeys.detail(workspaceId, taskId),
            task,
          );
        }
        invalidate();
      },
    }),
    startTimer: useMutation({
      mutationFn: () => api.startTimer(taskId),
      onSuccess: invalidate,
    }),
    stopTimer: useMutation({
      mutationFn: () => api.stopTimer(taskId),
      onSuccess: invalidate,
    }),
  };
}

export function useProjectAssignments(
  workspaceId: string | null,
  projectId: string,
) {
  return useQuery({
    queryKey: collabKeys.assignments(workspaceId ?? "none", projectId),
    queryFn: () => api.listProjectAssignments(projectId),
    enabled: Boolean(workspaceId) && Boolean(projectId),
  });
}

export function useProjectAssignmentActions(projectId: string) {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const invalidate = () => {
    if (workspaceId) {
      void queryClient.invalidateQueries({
        queryKey: collabKeys.assignments(workspaceId, projectId),
      });
    }
  };
  return {
    confirm: useMutation({
      mutationFn: () => api.confirmProjectAssignment(projectId),
      onSuccess: invalidate,
    }),
    returnAssignment: useMutation({
      mutationFn: () => api.returnProjectAssignment(projectId),
      onSuccess: invalidate,
    }),
    complete: useMutation({
      mutationFn: () => api.completeProjectAssignment(projectId),
      onSuccess: invalidate,
    }),
  };
}

export function useAssignProject(projectId: string) {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const invalidate = () => {
    if (workspaceId) {
      void queryClient.invalidateQueries({
        queryKey: collabKeys.assignments(workspaceId, projectId),
      });
      void queryClient.invalidateQueries({
        queryKey: projectKeys.all(workspaceId),
      });
    }
  };
  return useMutation({
    mutationFn: (input: {
      userId: string;
      role?: "OWNER" | "MANAGER" | "MEMBER" | "VIEWER";
    }) => api.assignProject(projectId, input.userId, input.role),
    onSuccess: invalidate,
  });
}

export function useUpdateProjectMemberRole(projectId: string) {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  return useMutation({
    mutationFn: (input: {
      userId: string;
      role: "OWNER" | "MANAGER" | "MEMBER" | "VIEWER";
    }) => api.updateProjectMemberRole(projectId, input.userId, input.role),
    onSuccess: () => {
      if (workspaceId) {
        void queryClient.invalidateQueries({
          queryKey: collabKeys.assignments(workspaceId, projectId),
        });
        void queryClient.invalidateQueries({
          queryKey: projectKeys.all(workspaceId),
        });
      }
    },
  });
}

export function useRemoveProjectMember(projectId: string) {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  return useMutation({
    mutationFn: (userId: string) => api.removeProjectMember(projectId, userId),
    onSuccess: () => {
      if (workspaceId) {
        void queryClient.invalidateQueries({
          queryKey: collabKeys.assignments(workspaceId, projectId),
        });
        void queryClient.invalidateQueries({
          queryKey: projectKeys.all(workspaceId),
        });
      }
    },
  });
}

export function usePlanDay() {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  return useMutation({
    mutationFn: async (date?: string) => {
      const plan = await api.planDay(date);
      if (plan.slots.length) {
        await api.applySchedule(plan.slots);
      }
      return plan;
    },
    onSuccess: () => {
      if (workspaceId) {
        void queryClient.invalidateQueries({
          queryKey: insightKeys.all(workspaceId),
        });
        void queryClient.invalidateQueries({
          queryKey: taskKeys.all(workspaceId),
        });
      }
    },
  });
}

export function usePlatformUsers(enabled: boolean) {
  return useQuery({
    queryKey: collabKeys.users,
    queryFn: api.listPlatformUsers,
    enabled,
    staleTime: 60_000,
  });
}
