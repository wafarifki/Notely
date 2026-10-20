export const PRIMARY_COLORS = ["purple", "green", "orange", "yellow", "pink", "cyan"] as const;

export type ProjectColor = (typeof PRIMARY_COLORS)[number];

export type ActorId =
    | "nick-woods"
    | "maya-hayes"
    | "cassie-melendez"
    | "ronny-schultz"
    | "amanda-finnegan"
    | "rob-houghton";

export type EntityKind = "project" | "note" | "task";

export type ActivityKind =
    | "created"
    | "updated"
    | "completed"
    | "reopened"
    | "moved"
    | "archived"
    | "deleted"
    | "favorited"
    | "pinned";

export interface ProjectRecord {
    id: string;
    name: string;
    description: string;
    color: ProjectColor;
    order: number;
    archived: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface NoteRecord {
    id: string;
    title: string;
    content: string;
    projectId: string | null;
    tags: string[];
    pinned: boolean;
    favorite: boolean;
    order: number;
    createdAt: string;
    updatedAt: string;
}

export interface TaskRecord {
    id: string;
    title: string;
    notes: string;
    projectId: string | null;
    completed: boolean;
    favorite: boolean;
    priority: "low" | "medium" | "high";
    dueAt: string | null;
    order: number;
    createdAt: string;
    updatedAt: string;
    completedAt: string | null;
}

export interface ActivityRecord {
    id: string;
    actorId: ActorId;
    actorName: string;
    kind: ActivityKind;
    entityType: EntityKind;
    entityId: string | null;
    title: string;
    projectId: string | null;
    createdAt: string;
}

export interface SettingsRecord {
    id: "app";
    displayName: string;
    email: string;
    avatarId: string;
    projectsExpanded: boolean;
    sidebarCollapsed: boolean;
    demoDragState: boolean;
    completedTasksVisible: boolean;
    showWeekends: boolean;
}

export interface SeedMetaRecord {
    id: "seed";
    seededAt: string;
    version: number;
}

export const UNASSIGNED_LABEL = "Unassigned";

export const COLOR_LABELS: Record<ProjectColor, string> = {
    purple: "Purple",
    green: "Green",
    orange: "Orange",
    yellow: "Yellow",
    pink: "Magenta",
    cyan: "Cyan"
};

export interface SettingsSnapshot {
    settings: SettingsRecord;
    projectCount: number;
    noteCount: number;
    taskCount: number;
    activityCount: number;
}

export interface ActivityInput {
    kind: ActivityKind;
    entityType: EntityKind;
    entityId: string | null;
    title: string;
    projectId?: string | null;
    actorId?: ActorId;
    actorName?: string;
    createdAt?: string;
}

export function sortProjects(projects: ProjectRecord[]): ProjectRecord[] {
    return [...projects].sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt));
}

export function sortTasks(tasks: TaskRecord[]): TaskRecord[] {
    return [...tasks].sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt));
}

export function sortNotes(notes: NoteRecord[]): NoteRecord[] {
    return [...notes].sort(
        (a, b) =>
            Number(b.pinned) - Number(a.pinned) ||
            a.order - b.order ||
            a.createdAt.localeCompare(b.createdAt)
    );
}
