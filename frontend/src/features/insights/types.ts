export type InsightPerson = {
  id: string;
  name: string;
  email?: string;
};

export type InsightProject = {
  id: string;
  name: string;
};

export type InsightTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  startDate: string | null;
  scheduledStart?: string | null;
  estimatedHours: number | null;
  project: InsightProject | null;
  updatedAt?: string;
  assignee?: InsightPerson | null;
  assignees?: InsightPerson[];
};

export type InsightMeeting = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  status: string;
  mode?: string;
  location?: string | null;
  meetingLink?: string | null;
  project: InsightProject | null;
  team?: InsightProject | null;
};

export type InsightSection<T> = {
  items: T[];
  total: number;
};

export type MyDayResponse = {
  date: string;
  hoursPerDay: number;
  todayTasks: InsightSection<InsightTask>;
  meetings: InsightSection<InsightMeeting>;
  dueTasks: InsightSection<InsightTask>;
  assignedWork: InsightSection<InsightTask>;
  scheduledWork: InsightSection<InsightTask>;
  overdueTasks?: InsightSection<InsightTask>;
  upcomingDeadlines?: InsightSection<InsightTask>;
  recentlyUpdated?: InsightSection<InsightTask>;
  completedTasks?: InsightSection<InsightTask>;
};

export type WorkloadWarning = {
  title: string;
  message: string;
};

export type WorkloadUser = {
  userId: string;
  name: string;
  email: string;
  todayHours: number;
  openHours: number;
  capacityHours: number;
  utilization: number;
  overloaded: boolean;
  unestimatedCount: number;
  openTaskCount: number;
  weekDeadlineCount?: number;
  warning?: WorkloadWarning | null;
};

export type WorkloadResponse = {
  date: string;
  hoursPerDay: number;
  page: number;
  pageSize: number;
  total: number;
  overloadedCount: number;
  users: WorkloadUser[];
};

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type RiskTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  blocked: boolean;
  score: number;
  level: RiskLevel;
  factors: {
    overdue: number;
    deadline: number;
    dependency: number;
    workload: number;
    priority: number;
  };
  assignee: InsightPerson | null;
  project: InsightProject | null;
};

export type RiskResponse = {
  date: string;
  hoursPerDay: number;
  page: number;
  pageSize: number;
  total: number;
  summary: {
    openTasks: number;
    overdueCount: number;
    blockedCount: number;
    overloadedAssignees: number;
    criticalCount: number;
    highCount: number;
    averageScore: number;
  };
  items: RiskTask[];
};

export type ReportsResponse = {
  from: string;
  to: string;
  hoursPerDay: number;
  completion: {
    byStatus: Record<string, number>;
    byPriority?: Record<string, number>;
    completed: number;
    open: number;
    created?: number;
    completionRate: number;
  };
  overdue: { count: number };
  meetings?: { count: number };
  workload: {
    memberCount: number;
    overloadedCount: number;
    todayHours: number;
    capacityHours: number;
    users?: Array<{
      userId: string;
      name: string;
      utilization: number;
      overloaded: boolean;
      openTaskCount: number;
      weekDeadlineCount: number;
    }>;
  };
  trends: Array<{ day: string; created: number; completed: number }>;
  projectPerformance: {
    page: number;
    pageSize: number;
    total: number;
    items: Array<{
      projectId: string | null;
      name: string;
      completed: number;
      overdue: number;
      open: number;
      total: number;
      completionRate: number;
    }>;
  };
};

export type DashboardTask = InsightTask & {
  assignee?: InsightPerson | null;
  assignees?: InsightPerson[];
};

export type DashboardMeeting = InsightMeeting & {
  mode?: string;
  location?: string | null;
  meetingLink?: string | null;
  organizer?: InsightPerson | null;
  participants?: InsightPerson[];
};

export type DashboardProject = {
  projectId: string;
  name: string;
  completed: number;
  open: number;
  percent: number;
  status?: string;
  dueDate?: string | null;
  members?: InsightPerson[];
};

export type DashboardResponse = {
  date: string;
  hoursPerDay: number;
  totals: {
    myTasks?: number;
    completed: number;
    overdue: number;
    upcomingMeetings?: number;
    total: number;
    inProgress: number;
  };
  myDay?: InsightSection<DashboardTask>;
  upcomingMeetings: InsightSection<DashboardMeeting>;
  projectProgress: DashboardProject[];
  activeProjects?: DashboardProject[];
  teamWorkload: Array<{
    userId: string;
    name: string;
    email?: string;
    utilization: number;
    overloaded: boolean;
    openTaskCount: number;
    weekDeadlineCount: number;
    warning: WorkloadWarning | null;
  }>;
  recentActivity: Array<{
    id: string;
    type: string;
    title: string;
    entityType: string | null;
    entityId: string | null;
    createdAt: string;
    actor: { id: string; name: string; email?: string } | null;
  }>;
  upcomingDeadlines?: Array<{
    id: string;
    title: string;
    dueDate: string;
    kind: "task" | "milestone" | "project";
    href: string;
    meta: string;
  }>;
  calendarPreview?: {
    events: Array<{
      id: string;
      type: "meeting" | "deadline" | "milestone";
      title: string;
      startAt: string;
      href: string;
    }>;
    week: Array<{ day: string; meetings: number; deadlines: number }>;
  };
};

export type PageParams = {
  date?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
  projectId?: string;
  teamId?: string;
  userId?: string;
};
