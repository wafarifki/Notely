import Dexie, { type Table } from "dexie";
import { DEMO_PROFILE, SEED_VERSION, buildSeedData } from "./seed";
import type {
    ActivityRecord,
    NoteRecord,
    ProjectRecord,
    SeedMetaRecord,
    SettingsRecord,
    TaskRecord
} from "./schema";

export const DB_NAME = "notes-desktop";
export const DB_VERSION = 1;

export class NotesDatabase extends Dexie {
    projects!: Table<ProjectRecord, string>;
    notes!: Table<NoteRecord, string>;
    tasks!: Table<TaskRecord, string>;
    activity!: Table<ActivityRecord, string>;
    settings!: Table<SettingsRecord, string>;
    meta!: Table<SeedMetaRecord, string>;

    constructor(name: string = DB_NAME) {
        super(name);
        this.version(DB_VERSION).stores({
            projects: "id, order, archived, color, updatedAt",
            notes: "id, projectId, pinned, favorite, order, updatedAt, *tags",
            tasks: "id, projectId, completed, favorite, dueAt, order",
            activity: "id, createdAt, entityType, entityId",
            settings: "id",
            meta: "id"
        });
    }
}

export async function seedIfEmpty(db: NotesDatabase, now: Date = new Date()): Promise<boolean> {
    return db.transaction(
        "rw",
        [db.projects, db.notes, db.tasks, db.activity, db.settings, db.meta],
        async () => {
            const [projectCount, noteCount, taskCount, settingsCount] = await Promise.all([
                db.projects.count(),
                db.notes.count(),
                db.tasks.count(),
                db.settings.count()
            ]);

            if (projectCount + noteCount + taskCount + settingsCount > 0) {
                return false;
            }

            const seed = buildSeedData(now);
            await db.projects.bulkAdd(seed.projects);
            await db.notes.bulkAdd(seed.notes);
            await db.tasks.bulkAdd(seed.tasks);
            await db.activity.bulkAdd(seed.activity);
            await db.settings.put(seed.settings);
            await db.meta.put({
                id: "seed",
                seededAt: now.toISOString(),
                version: SEED_VERSION
            });
            return true;
        }
    );
}

export async function resetToDemoData(db: NotesDatabase, now: Date = new Date()): Promise<void> {
    await db.transaction(
        "rw",
        [db.projects, db.notes, db.tasks, db.activity, db.settings, db.meta],
        async () => {
            await Promise.all([
                db.projects.clear(),
                db.notes.clear(),
                db.tasks.clear(),
                db.activity.clear(),
                db.settings.clear(),
                db.meta.clear()
            ]);
            const seed = buildSeedData(now);
            await db.projects.bulkAdd(seed.projects);
            await db.notes.bulkAdd(seed.notes);
            await db.tasks.bulkAdd(seed.tasks);
            await db.activity.bulkAdd(seed.activity);
            await db.settings.put(seed.settings);
            await db.meta.put({
                id: "seed",
                seededAt: now.toISOString(),
                version: SEED_VERSION
            });
        }
    );
}

export async function ensureSettings(db: NotesDatabase): Promise<SettingsRecord> {
    const existing = await db.settings.get("app");
    if (existing) {
        return existing;
    }
    await db.settings.put({ ...DEMO_PROFILE });
    return { ...DEMO_PROFILE };
}

let sharedDatabase: NotesDatabase | null = null;

export function getDatabase(): NotesDatabase {
    if (!sharedDatabase) {
        sharedDatabase = new NotesDatabase();
    }
    return sharedDatabase;
}
