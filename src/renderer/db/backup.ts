import type { NotesDatabase } from "./database";
import { PRIMARY_COLORS, type ProjectColor, type SettingsRecord } from "./schema";

export const EXPORT_FORMAT = "notes-desktop-backup";
export const EXPORT_VERSION = 1;

interface BackupProject {
    id: string;
    name: string;
    description: string;
    color: ProjectColor;
    order: number;
    archived: boolean;
    createdAt: string;
    updatedAt: string;
}

interface BackupNote {
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

interface BackupTask {
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

export interface BackupFile {
    format: typeof EXPORT_FORMAT;
    version: typeof EXPORT_VERSION;
    exportedAt: string;
    settings: SettingsRecord;
    projects: BackupProject[];
    notes: BackupNote[];
    tasks: BackupTask[];
}

export type ImportMode = "merge" | "replace";

export interface ImportPreview {
    projects: number;
    notes: number;
    tasks: number;
    exportedAt: string | null;
    conflicts: number;
}

export class ImportValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ImportValidationError";
    }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const TASK_PRIORITY = ["low", "medium", "high"];

function fail(path: string, message: string): never {
    throw new ImportValidationError(`${path}: ${message}`);
}

function asRecord(value: unknown, path: string): Record<string, unknown> {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        fail(path, "expected an object");
    }
    return value as Record<string, unknown>;
}

function asArray(value: unknown, path: string): unknown[] {
    if (!Array.isArray(value)) fail(path, "expected an array");
    return value as unknown[];
}

function asString(value: unknown, path: string, { allowEmpty = false } = {}): string {
    if (typeof value !== "string") fail(path, "expected a string");
    if (!allowEmpty && value.trim() === "") fail(path, "must not be empty");
    return value;
}

function asBoolean(value: unknown, path: string): boolean {
    if (typeof value !== "boolean") fail(path, "expected a boolean");
    return value;
}

function asInteger(value: unknown, path: string): number {
    if (typeof value !== "number" || !Number.isInteger(value)) fail(path, "expected an integer");
    return value;
}

function asDate(value: unknown, path: string): string {
    const text = asString(value, path);
    if (!ISO_DATE.test(text) || Number.isNaN(new Date(text).getTime())) {
        fail(path, "expected an ISO timestamp");
    }
    return text;
}

function asNullableDate(value: unknown, path: string): string | null {
    return value === null ? null : asDate(value, path);
}

function asProjectColor(value: unknown, path: string): ProjectColor {
    if (typeof value !== "string" || !PRIMARY_COLORS.includes(value as ProjectColor)) {
        fail(path, `expected one of ${PRIMARY_COLORS.join(", ")}`);
    }
    return value as ProjectColor;
}

export function parseBackup(input: unknown): BackupFile {
    const root = asRecord(input, "file");
    if (root.format !== EXPORT_FORMAT) {
        fail("file.format", `expected "${EXPORT_FORMAT}"`);
    }
    if (root.version !== EXPORT_VERSION) {
        fail("file.version", `unsupported version (expected ${EXPORT_VERSION})`);
    }
    const exportedAt = asDate(root.exportedAt, "file.exportedAt");
    const settingsRaw = asRecord(root.settings, "file.settings");
    const settings: SettingsRecord = {
        id: "app",
        displayName: asString(settingsRaw.displayName, "settings.displayName"),
        email: asString(settingsRaw.email, "settings.email"),
        avatarId: asString(settingsRaw.avatarId, "settings.avatarId"),
        projectsExpanded: asBoolean(settingsRaw.projectsExpanded, "settings.projectsExpanded"),
        sidebarCollapsed: asBoolean(settingsRaw.sidebarCollapsed, "settings.sidebarCollapsed"),
        demoDragState: asBoolean(settingsRaw.demoDragState, "settings.demoDragState"),
        completedTasksVisible: asBoolean(
            settingsRaw.completedTasksVisible ?? true,
            "settings.completedTasksVisible"
        ),
        showWeekends: asBoolean(settingsRaw.showWeekends ?? true, "settings.showWeekends")
    };

    const projectIds = new Set<string>();
    const projects = asArray(root.projects, "file.projects").map((raw, index): BackupProject => {
        const path = `projects[${index}]`;
        const item = asRecord(raw, path);
        const id = asString(item.id, `${path}.id`);
        if (projectIds.has(id)) fail(`${path}.id`, "duplicate project id");
        projectIds.add(id);
        return {
            id,
            name: asString(item.name, `${path}.name`).slice(0, 120),
            description: typeof item.description === "string" ? item.description.slice(0, 600) : "",
            color: asProjectColor(item.color, `${path}.color`),
            order: asInteger(item.order, `${path}.order`),
            archived: asBoolean(item.archived, `${path}.archived`),
            createdAt: asDate(item.createdAt, `${path}.createdAt`),
            updatedAt: asDate(item.updatedAt, `${path}.updatedAt`)
        };
    });

    const noteIds = new Set<string>();
    const notes = asArray(root.notes, "file.notes").map((raw, index): BackupNote => {
        const path = `notes[${index}]`;
        const item = asRecord(raw, path);
        const id = asString(item.id, `${path}.id`);
        if (noteIds.has(id)) fail(`${path}.id`, "duplicate note id");
        noteIds.add(id);
        const projectId = item.projectId === null ? null : asString(item.projectId, `${path}.projectId`);
        if (projectId !== null && !projectIds.has(projectId)) {
            fail(`${path}.projectId`, "references a project that is not in the file");
        }
        const tags = asArray(item.tags ?? [], `${path}.tags`).map((tag, tagIndex) =>
            asString(tag, `${path}.tags[${tagIndex}]`).slice(0, 40)
        );
        return {
            id,
            title: typeof item.title === "string" ? item.title.slice(0, 200) : "",
            content: typeof item.content === "string" ? item.content : "",
            projectId,
            tags: tags.slice(0, 12),
            pinned: asBoolean(item.pinned ?? false, `${path}.pinned`),
            favorite: asBoolean(item.favorite ?? false, `${path}.favorite`),
            order: asInteger(item.order, `${path}.order`),
            createdAt: asDate(item.createdAt, `${path}.createdAt`),
            updatedAt: asDate(item.updatedAt, `${path}.updatedAt`)
        };
    });

    const taskIds = new Set<string>();
    const tasks = asArray(root.tasks, "file.tasks").map((raw, index): BackupTask => {
        const path = `tasks[${index}]`;
        const item = asRecord(raw, path);
        const id = asString(item.id, `${path}.id`);
        if (taskIds.has(id)) fail(`${path}.id`, "duplicate task id");
        taskIds.add(id);
        const projectId = item.projectId === null ? null : asString(item.projectId, `${path}.projectId`);
        if (projectId !== null && !projectIds.has(projectId)) {
            fail(`${path}.projectId`, "references a project that is not in the file");
        }
        const priority = asString(item.priority ?? "medium", `${path}.priority`);
        if (!TASK_PRIORITY.includes(priority)) fail(`${path}.priority`, "expected low, medium or high");
        return {
            id,
            title: asString(item.title, `${path}.title`).slice(0, 160),
            notes: typeof item.notes === "string" ? item.notes.slice(0, 2000) : "",
            projectId,
            completed: asBoolean(item.completed, `${path}.completed`),
            favorite: asBoolean(item.favorite ?? false, `${path}.favorite`),
            priority: priority as BackupTask["priority"],
            dueAt: asNullableDate(item.dueAt ?? null, `${path}.dueAt`),
            order: asInteger(item.order, `${path}.order`),
            createdAt: asDate(item.createdAt, `${path}.createdAt`),
            updatedAt: asDate(item.updatedAt, `${path}.updatedAt`),
            completedAt: asNullableDate(item.completedAt ?? null, `${path}.completedAt`)
        };
    });

    return { format: EXPORT_FORMAT, version: EXPORT_VERSION, exportedAt, settings, projects, notes, tasks };
}

export async function exportDatabase(db: NotesDatabase): Promise<BackupFile> {
    const [projects, notes, tasks, settings] = await Promise.all([
        db.projects.toArray(),
        db.notes.toArray(),
        db.tasks.toArray(),
        db.settings.get("app")
    ]);
    return {
        format: EXPORT_FORMAT,
        version: EXPORT_VERSION,
        exportedAt: new Date().toISOString(),
        settings:
            settings ?? {
                id: "app",
                displayName: "Nick Woods",
                email: "nick.woods@gmail.com",
                avatarId: "nick-woods",
                projectsExpanded: true,
                sidebarCollapsed: false,
                demoDragState: true,
                completedTasksVisible: true,
                showWeekends: true
            },
        projects: projects.map((project) => ({ ...project })),
        notes: notes.map((note) => ({ ...note })),
        tasks: tasks.map((task) => ({ ...task }))
    };
}

export function summarizeImport(backup: BackupFile, existingIds: Set<string>): ImportPreview {
    const uniqueIds = new Set([...backup.projects, ...backup.notes, ...backup.tasks].map((item) => item.id));
    return {
        projects: backup.projects.length,
        notes: backup.notes.length,
        tasks: backup.tasks.length,
        exportedAt: backup.exportedAt,
        conflicts: [...uniqueIds].filter((id) => existingIds.has(id)).length
    };
}

export async function applyImport(
    db: NotesDatabase,
    backup: BackupFile,
    mode: ImportMode
): Promise<void> {
    await db.transaction(
        "rw",
        [db.projects, db.notes, db.tasks, db.settings],
        async () => {
            if (mode === "replace") {
                await Promise.all([db.projects.clear(), db.notes.clear(), db.tasks.clear()]);
                await db.settings.put(backup.settings);
            }
            await db.projects.bulkPut(backup.projects);
            await db.notes.bulkPut(backup.notes);
            await db.tasks.bulkPut(backup.tasks);
        }
    );
}
