export const PRIMARY_COLORS = ["purple", "green", "orange", "yellow", "pink", "cyan"] as const;

export type ProjectColor = (typeof PRIMARY_COLORS)[number];

// ─── OLD CODE (kept for reference) ───
// export type ActorId =
//     | "nick-woods"
//     | "maya-hayes"
//     | "cassie-melendez"
//     | "ronny-schultz"
//     | "amanda-finnegan"
//     | "rob-houghton";
// ─── NEW: the actor is now the signed-in profile, whose avatar can also be an
// uploaded photo id. Keeping it a plain string lets both the six demo avatars
// and a real profile id flow through without casts. ───
export type ActorId = string;

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
    // ─── NEW: archived notes stay in the database but leave the active lists. ───
    archived: boolean;
    // ─── NEW: absolute path of the `.txt` / `.md` file this note was imported
    // from. Re-opening the same file then updates this note instead of piling
    // up duplicates in the list. Undefined for notes typed inside Notely. ───
    sourcePath?: string | null;
    order: number;
    createdAt: string;
    updatedAt: string;
}

export interface TaskChecklistItem {
    id: string;
    text: string;
    done: boolean;
}

export interface TaskRecord {
    id: string;
    title: string;
    notes: string;
    projectId: string | null;
    completed: boolean;
    favorite: boolean;
    // ─── NEW: archived tasks stay in the database but leave the active lists. ───
    archived: boolean;
    // ─── NEW: optional sub-steps inside a task. ───
    checklist: TaskChecklistItem[];
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
    // ─── NEW: snapshot of the actor's uploaded photo, so history keeps showing
    // the right face even after the profile picture changes. ───
    actorImage?: string | null;
    kind: ActivityKind;
    entityType: EntityKind;
    entityId: string | null;
    title: string;
    projectId: string | null;
    createdAt: string;
}

export type ThemeMode = "light" | "dark" | "auto";

export type AccentName = "purple" | "blue" | "green" | "orange" | "pink" | "teal";

export type LanguageCode = "en" | "id";

export interface SettingsRecord {
    id: "app";
    displayName: string;
    email: string;
    avatarId: string;
    // ─── NEW: user-uploaded profile photo stored inline as a data URL.
    // When present it takes precedence over the preset avatarId.
    avatarImage: string | null;
    avatarImageUpdatedAt: string | null;
    projectsExpanded: boolean;
    sidebarCollapsed: boolean;
    completedTasksVisible: boolean;
    showWeekends: boolean;
    theme: ThemeMode;
    accent: AccentName;
    customAccent: string | null;
    customCanvas: string | null;
    // ─── NEW: interface language. English is the default.
    language: LanguageCode;
    tourCompleted: boolean;
    // ─── NEW: true once the welcome tour has been shown on first launch, so it
    // never auto-starts again even after the workspace is emptied.
    hasSeenTour: boolean;
    animatedBackground: boolean;
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

export interface ActivityInput {
    kind: ActivityKind;
    entityType: EntityKind;
    entityId: string | null;
    title: string;
    projectId?: string | null;
    actorId?: ActorId;
    actorName?: string;
    actorImage?: string | null;
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
