export type TemplateTaskSpec = {
  key: string;
  title: string;
  description?: string;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  estimatedHours?: number;
  parentKey?: string;
  milestoneKey?: string;
  dependsOnKeys?: string[];
};

export type TemplateMilestoneSpec = {
  key: string;
  title: string;
  dueOffsetDays?: number;
};

export type TemplatePayload = {
  milestones: TemplateMilestoneSpec[];
  tasks: TemplateTaskSpec[];
};

export type BuiltinTemplate = {
  id: string;
  name: string;
  description: string;
  builtin: true;
  payload: TemplatePayload;
};

export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  {
    id: "builtin:software-development",
    name: "Software Development",
    description: "Design, build, test, and ship a software release.",
    builtin: true,
    payload: {
      milestones: [
        { key: "m-design", title: "Design complete", dueOffsetDays: 14 },
        { key: "m-build", title: "Build complete", dueOffsetDays: 35 },
        { key: "m-launch", title: "Release", dueOffsetDays: 49 },
      ],
      tasks: [
        {
          key: "design",
          title: "Design UI",
          priority: "HIGH",
          estimatedHours: 16,
          milestoneKey: "m-design",
        },
        {
          key: "dev",
          title: "Development",
          priority: "HIGH",
          estimatedHours: 40,
          milestoneKey: "m-build",
          dependsOnKeys: ["design"],
        },
        {
          key: "test",
          title: "Testing",
          priority: "MEDIUM",
          estimatedHours: 16,
          milestoneKey: "m-build",
          dependsOnKeys: ["dev"],
        },
        {
          key: "deploy",
          title: "Deployment",
          priority: "URGENT",
          estimatedHours: 8,
          milestoneKey: "m-launch",
          dependsOnKeys: ["test"],
        },
      ],
    },
  },
  {
    id: "builtin:marketing-campaign",
    name: "Marketing Campaign",
    description: "Plan, produce, and launch a campaign.",
    builtin: true,
    payload: {
      milestones: [
        { key: "m-brief", title: "Brief approved", dueOffsetDays: 7 },
        { key: "m-live", title: "Campaign live", dueOffsetDays: 28 },
      ],
      tasks: [
        { key: "brief", title: "Write campaign brief", priority: "HIGH", estimatedHours: 6, milestoneKey: "m-brief" },
        {
          key: "assets",
          title: "Create assets",
          priority: "HIGH",
          estimatedHours: 20,
          milestoneKey: "m-live",
          dependsOnKeys: ["brief"],
        },
        {
          key: "launch",
          title: "Launch campaign",
          priority: "URGENT",
          estimatedHours: 8,
          milestoneKey: "m-live",
          dependsOnKeys: ["assets"],
        },
      ],
    },
  },
  {
    id: "builtin:product-launch",
    name: "Product Launch",
    description: "Coordinate a product go-to-market launch.",
    builtin: true,
    payload: {
      milestones: [
        { key: "m-ready", title: "Launch ready", dueOffsetDays: 30 },
        { key: "m-day", title: "Launch day", dueOffsetDays: 45 },
      ],
      tasks: [
        { key: "positioning", title: "Positioning and messaging", priority: "HIGH", estimatedHours: 10, milestoneKey: "m-ready" },
        {
          key: "enablement",
          title: "Sales enablement",
          priority: "MEDIUM",
          estimatedHours: 12,
          milestoneKey: "m-ready",
          dependsOnKeys: ["positioning"],
        },
        {
          key: "launch",
          title: "Launch event",
          priority: "URGENT",
          estimatedHours: 16,
          milestoneKey: "m-day",
          dependsOnKeys: ["enablement"],
        },
      ],
    },
  },
  {
    id: "builtin:event-planning",
    name: "Event Planning",
    description: "Plan and run an internal or customer event.",
    builtin: true,
    payload: {
      milestones: [
        { key: "m-booked", title: "Venue booked", dueOffsetDays: 10 },
        { key: "m-event", title: "Event day", dueOffsetDays: 40 },
      ],
      tasks: [
        { key: "venue", title: "Book venue", priority: "HIGH", estimatedHours: 4, milestoneKey: "m-booked" },
        {
          key: "agenda",
          title: "Finalize agenda",
          priority: "MEDIUM",
          estimatedHours: 8,
          milestoneKey: "m-event",
          dependsOnKeys: ["venue"],
        },
        {
          key: "run",
          title: "Run the event",
          priority: "HIGH",
          estimatedHours: 12,
          milestoneKey: "m-event",
          dependsOnKeys: ["agenda"],
        },
      ],
    },
  },
  {
    id: "builtin:hr-recruitment",
    name: "HR Recruitment",
    description: "Hire for an open role from intake to offer.",
    builtin: true,
    payload: {
      milestones: [
        { key: "m-intake", title: "Intake complete", dueOffsetDays: 5 },
        { key: "m-offer", title: "Offer accepted", dueOffsetDays: 28 },
      ],
      tasks: [
        { key: "intake", title: "Role intake", priority: "HIGH", estimatedHours: 3, milestoneKey: "m-intake" },
        {
          key: "screen",
          title: "Screen candidates",
          priority: "MEDIUM",
          estimatedHours: 10,
          milestoneKey: "m-offer",
          dependsOnKeys: ["intake"],
        },
        {
          key: "offer",
          title: "Prepare offer",
          priority: "HIGH",
          estimatedHours: 4,
          milestoneKey: "m-offer",
          dependsOnKeys: ["screen"],
        },
      ],
    },
  },
];
