export const PROJECT_STATUSES = [
  "PLANNING",
  "ACTIVE",
  "ON_HOLD",
  "COMPLETED",
  "ARCHIVED",
] as const;

export const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type Priority = (typeof PRIORITIES)[number];

export type ProjectPerson = {
  id: string;
  name: string;
  email: string;
};

export type Project = {
  id: string;
  name: string;
  description: string | null;
  icon?: string | null;
  status: ProjectStatus;
  priority: Priority;
  startDate: string | null;
  endDate: string | null;
  dueDate?: string | null;
  workspaceId: string;
  ownerId: string;
  teamId: string | null;
  team?: { id: string; name: string; icon: string | null } | null;
  createdAt: string;
  updatedAt: string;
  owner: ProjectPerson;
  progress?: { completed: number; total: number; percent: number };
  members?: Array<{
    id: string;
    userId: string;
    status: string;
    role: "OWNER" | "MANAGER" | "MEMBER" | "VIEWER";
    createdAt: string;
    user: ProjectPerson;
  }>;
  myAccess?: "NONE" | "VIEW" | "EDIT" | "MANAGE" | "OWN";
  _count: { tasks: number; assignments?: number };
};

export type CreateProjectInput = {
  name: string;
  description?: string;
  status?: ProjectStatus;
  priority?: Priority;
  startDate?: string;
  endDate?: string;
  dueDate?: string;
  teamId?: string;
  icon?: string;
};

export type UpdateProjectInput = {
  name?: string;
  description?: string | null;
  icon?: string | null;
  status?: ProjectStatus;
  priority?: Priority;
  startDate?: string | null;
  endDate?: string | null;
  dueDate?: string | null;
  teamId?: string | null;
};

export type ProjectMilestone = {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  position: number;
  progress: number;
  taskCount: number;
};

export type ProjectTimelineTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  startDate: string | null;
  dueDate: string | null;
  milestoneId: string | null;
  parentId: string | null;
  blocked: boolean;
  dependsOn: string[];
};

export type ProjectTimeline = {
  project: { id: string; name: string };
  canEdit: boolean;
  range: { start: string; end: string };
  milestones: ProjectMilestone[];
  tasks: ProjectTimelineTask[];
};

export type ProjectTemplate = {
  id: string;
  name: string;
  description: string | null;
  builtin: boolean;
  createdAt?: string;
  payload?: {
    milestones: Array<{ key: string; title: string }>;
    tasks: Array<{ key: string; title: string; parentKey?: string }>;
  };
};
