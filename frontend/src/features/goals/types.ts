export type GoalProject = {
  id: string;
  name: string;
  status: string;
  progress?: number;
  taskCount?: number;
  milestones?: GoalMilestone[];
};

export type GoalMilestone = {
  id: string;
  title: string;
  description?: string | null;
  dueDate: string | null;
  position: number;
  progress: number;
};

export type GoalTask = {
  id: string;
  title: string;
  status: string;
  projectId: string | null;
  milestoneId: string | null;
};

export type Goal = {
  id: string;
  title: string;
  description: string | null;
  targetDate: string | null;
  progress: number;
  workspaceId: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  owner: { id: string; name: string; email: string };
  projects: GoalProject[];
  milestones: GoalMilestone[];
  tasks?: GoalTask[];
};

export type GoalMilestoneInput = {
  title: string;
  description?: string;
  dueDate?: string;
  progress?: number;
};

export type GoalWriteInput = {
  title: string;
  description?: string;
  targetDate?: string;
  progress?: number;
  projectIds: string[];
  taskIds?: string[];
  milestones: GoalMilestoneInput[];
};
