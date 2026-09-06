export type Person = {
  id: string;
  name: string;
  email: string;
};

export type InboxNotification = {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  type: string;
  entityId: string | null;
  entityType: string | null;
  createdAt: string;
};

export type NotificationPrefs = {
  inApp: boolean;
  email: boolean;
};

export type NotificationList = {
  items: InboxNotification[];
  unreadCount: number;
  prefs: NotificationPrefs;
};

export type Team = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  ownerId: string;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
  owner: Person;
  createdBy?: Person;
  activeTaskCount: number;
  members: Array<{
    id: string;
    userId: string;
    role: "ADMIN" | "MEMBER";
    createdAt: string;
    user: Person;
  }>;
  _count: { projects: number; members: number };
};

export type FileAttach = {
  taskId?: string;
  projectId?: string;
  meetingId?: string;
  teamId?: string;
  pageId?: string;
  conversationId?: string;
  commentId?: string;
  messageId?: string;
};

export type WorkspaceFile = {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  taskId: string | null;
  projectId: string | null;
  meetingId: string | null;
  teamId: string | null;
  pageId: string | null;
  conversationId: string | null;
  commentId: string | null;
  messageId: string | null;
  createdAt: string;
  uploadedBy?: Person;
};

export type WorkspacePage = {
  id: string;
  title: string;
  body: string;
  workspaceId: string;
  authorId: string;
  createdAt: string;
  updatedAt: string;
  author: Person;
};

export type TaskComment = {
  id: string;
  body: string;
  parentId: string | null;
  createdAt: string;
  author: Person;
  files: Array<{
    id: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
  }>;
  reactions: Array<{
    emoji: string;
    userIds: string[];
    count: number;
  }>;
  taskId?: string;
};

export type TimeEntry = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  minutes: number | null;
};

export type ProjectAssignment = {
  id: string;
  userId: string;
  status: "PENDING" | "IN_PROGRESS" | "RETURNED" | "COMPLETED";
  role?: "OWNER" | "MANAGER" | "MEMBER" | "VIEWER";
  createdAt: string;
  user: Person;
};

export type PlanDaySlot = {
  taskId: string;
  title: string;
  scheduledStart: string;
  scheduledEnd: string;
};

export type PlanDayResult = {
  date: string;
  summary: string;
  slots: PlanDaySlot[];
  source: "ai" | "heuristic";
  unavailableReason?: string;
};

export type PlatformUser = {
  id: string;
  email: string;
  name: string;
  role: "SUPER_ADMIN" | "ADMIN" | "MEMBER";
  createdAt: string;
  updatedAt: string;
};
