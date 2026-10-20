import Dexie, { type Table } from "dexie";
import { createDefaultProfile } from "./seed";
import type {
    ActivityRecord,
    NoteRecord,
    ProjectRecord,
    SettingsRecord,
    TaskRecord
} from "./schema";

export const DB_NAME = "notely";
// ─── OLD CODE (kept for reference) ───
// export const DB_VERSION = 2;
// ─── NEW: version 3 normalises profiles written before the upload/photo
// and language fields existed, so older installs keep working. ───
// ─── NEW: version 4 adds an `archived` flag to notes and tasks. ───
// ─── NEW: version 5 adds `hasSeenTour` so the welcome tour only auto-runs once. ───
// ─── NEW: version 6 adds the optional task checklist. ───
export const DB_VERSION = 6;

export class NotesDatabase extends Dexie {
    projects!: Table<ProjectRecord, string>;
    notes!: Table<NoteRecord, string>;
    tasks!: Table<TaskRecord, string>;
    activity!: Table<ActivityRecord, string>;
    settings!: Table<SettingsRecord, string>;

    constructor(name: string = DB_NAME) {
        super(name);
        this.version(1).stores({
            projects: "id, order, archived, color, updatedAt",
            notes: "id, projectId, pinned, favorite, order, updatedAt, *tags",
            tasks: "id, projectId, completed, favorite, dueAt, order",
            activity: "id, createdAt, entityType, entityId",
            settings: "id",
            meta: "id"
        });
        this.version(DB_VERSION)
            .stores({
                projects: "id, order, archived, color, updatedAt",
                notes: "id, projectId, pinned, favorite, order, updatedAt, *tags",
                tasks: "id, projectId, completed, favorite, dueAt, order",
                activity: "id, createdAt, entityType, entityId",
                settings: "id"
            })
            .upgrade(async (transaction) => {
                const table = transaction.table("settings");
                const settings = (await table.get("app")) as (SettingsRecord & Record<string, unknown>) | undefined;
                if (!settings) return;
                // ─── NEW: fill in fields introduced after this row was written. ───
                const migrated: SettingsRecord = {
                    ...createDefaultProfile(),
                    ...settings,
                    id: "app",
                    theme: (settings.theme as SettingsRecord["theme"]) ?? "auto",
                    accent: (settings.accent as SettingsRecord["accent"]) ?? "purple",
                    displayName: settings.displayName ?? "Notely",
                    email: settings.email ?? "user@user.com",
                    avatarId: settings.avatarId ?? "nick-woods",
                    avatarImage: typeof settings.avatarImage === "string" ? settings.avatarImage : null,
                    avatarImageUpdatedAt:
                        typeof settings.avatarImageUpdatedAt === "string" ? settings.avatarImageUpdatedAt : null,
                    language: settings.language === "id" ? "id" : "en",
                    projectsExpanded: settings.projectsExpanded ?? true,
                    sidebarCollapsed: settings.sidebarCollapsed ?? false,
                    completedTasksVisible: settings.completedTasksVisible ?? true,
                    showWeekends: settings.showWeekends ?? true
                };
                await table.put(migrated);
            });

        // ─── NEW: v4 only adds the `archived` flag, so every existing note and
        // task is marked as active and keeps its place in the lists. ───
        this.version(4)
            .stores({
                projects: "id, order, archived, color, updatedAt",
                notes: "id, projectId, pinned, favorite, archived, order, updatedAt, *tags",
                tasks: "id, projectId, completed, favorite, archived, dueAt, order",
                activity: "id, createdAt, entityType, entityId",
                settings: "id"
            })
            .upgrade(async (transaction) => {
                await transaction
                    .table("notes")
                    .toCollection()
                    .modify((row: Record<string, unknown>) => {
                        if (typeof row.archived !== "boolean") row.archived = false;
                    });
                await transaction
                    .table("tasks")
                    .toCollection()
                    .modify((row: Record<string, unknown>) => {
                        if (typeof row.archived !== "boolean") row.archived = false;
                    });
            });

        // ─── NEW: v5 backfills `hasSeenTour`. Existing installs already went
        // through the product once, so they are marked as seen and never get
        // the tour forced on them again. ───
        this.version(5)
            .stores({
                projects: "id, order, archived, color, updatedAt",
                notes: "id, projectId, pinned, favorite, archived, order, updatedAt, *tags",
                tasks: "id, projectId, completed, favorite, archived, dueAt, order",
                activity: "id, createdAt, entityType, entityId",
                settings: "id"
            })
            .upgrade(async (transaction) => {
                await transaction
                    .table("settings")
                    .toCollection()
                    .modify((row: Record<string, unknown>) => {
                        if (typeof row.hasSeenTour !== "boolean") row.hasSeenTour = true;
                    });
            });

        // ─── NEW: v6 gives every existing task an empty checklist so the field
        // is always an array and the UI never has to guess. ───
        this.version(6)
            .stores({
                projects: "id, order, archived, color, updatedAt",
                notes: "id, projectId, pinned, favorite, archived, order, updatedAt, *tags",
                tasks: "id, projectId, completed, favorite, archived, dueAt, order",
                activity: "id, createdAt, entityType, entityId",
                settings: "id"
            })
            .upgrade(async (transaction) => {
                await transaction
                    .table("tasks")
                    .toCollection()
                    .modify((row: Record<string, unknown>) => {
                        if (!Array.isArray(row.checklist)) row.checklist = [];
                    });
            });
    }
}

export async function ensureSettings(db: NotesDatabase): Promise<SettingsRecord> {
    const existing = await db.settings.get("app");
    if (existing) {
        return existing;
    }
    const profile = createDefaultProfile();
    await db.settings.put(profile);
    return profile;
}

export async function clearWorkspace(db: NotesDatabase): Promise<void> {
    await db.transaction("rw", [db.projects, db.notes, db.tasks, db.activity], async () => {
        await Promise.all([db.projects.clear(), db.notes.clear(), db.tasks.clear(), db.activity.clear()]);
    });
}

export function deleteStoredDatabase(name: string = DB_NAME): Promise<void> {
    return Dexie.delete(name);
}

let sharedDatabase: NotesDatabase | null = null;

export function getDatabase(): NotesDatabase {
    if (!sharedDatabase) {
        sharedDatabase = new NotesDatabase();
    }
    return sharedDatabase;
}
