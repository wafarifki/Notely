import { createId } from "@/lib/ids";
import type { NotesDatabase } from "./database";
import { PRIMARY_COLORS, type ProjectColor, type ProjectRecord } from "./schema";

export interface ProjectInput {
    name: string;
    description?: string;
    color: ProjectColor;
}

export type ProjectDeleteStrategy = "unassign" | "delete";

export class ValidationError extends Error {
    field: string;

    constructor(field: string, message: string) {
        super(message);
        this.name = "ValidationError";
        this.field = field;
    }
}

export interface ProjectRelations {
    noteCount: number;
    taskCount: number;
}

export function validateProjectInput(input: ProjectInput): ProjectInput {
    const name = input.name.trim();
    if (!name) {
        throw new ValidationError("name", "Project name is required.");
    }
    if (name.length > 120) {
        throw new ValidationError("name", "Project name must be 120 characters or fewer.");
    }
    if (!PRIMARY_COLORS.includes(input.color)) {
        throw new ValidationError("color", "Choose one of the available project colors.");
    }
    return {
        name,
        description: (input.description ?? "").trim().slice(0, 600),
        color: input.color
    };
}

export function projectRepository(db: NotesDatabase) {
    async function resolveProjectId(projectId: string | null): Promise<string | null> {
        if (!projectId) return null;
        const project = await db.projects.get(projectId);
        return project ? project.id : null;
    }

    return {
        async list(includeArchived = true): Promise<ProjectRecord[]> {
            const rows = await db.projects.orderBy("order").toArray();
            return includeArchived ? rows : rows.filter((row) => !row.archived);
        },

        async get(id: string): Promise<ProjectRecord | undefined> {
            return db.projects.get(id);
        },

        async create(input: ProjectInput): Promise<ProjectRecord> {
            const data = validateProjectInput(input);
            const now = new Date().toISOString();
            const all = await db.projects.toArray();
            const record: ProjectRecord = {
                id: createId("project"),
                name: data.name,
                description: data.description ?? "",
                color: data.color,
                order: all.reduce((max, project) => Math.max(max, project.order), -1) + 1,
                archived: false,
                createdAt: now,
                updatedAt: now
            };
            await db.projects.add(record);
            return record;
        },

        async update(id: string, input: ProjectInput): Promise<ProjectRecord> {
            const data = validateProjectInput(input);
            const existing = await db.projects.get(id);
            if (!existing) {
                throw new Error("Project no longer exists.");
            }
            const next: ProjectRecord = {
                ...existing,
                name: data.name,
                description: data.description ?? "",
                color: data.color,
                updatedAt: new Date().toISOString()
            };
            await db.projects.put(next);
            return next;
        },

        async setArchived(id: string, archived: boolean): Promise<ProjectRecord> {
            const existing = await db.projects.get(id);
            if (!existing) {
                throw new Error("Project no longer exists.");
            }
            const next = { ...existing, archived, updatedAt: new Date().toISOString() };
            await db.projects.put(next);
            return next;
        },

        async reorder(orderedIds: string[]): Promise<ProjectRecord[]> {
            const rows = await db.projects.toArray();
            const byId = new Map(rows.map((row) => [row.id, row]));
            const now = new Date().toISOString();
            const updated: ProjectRecord[] = [];
            orderedIds.forEach((id, index) => {
                const row = byId.get(id);
                if (!row) return;
                updated.push({ ...row, order: index, updatedAt: now });
                byId.delete(id);
            });
            const rest = [...byId.values()].sort((a, b) => a.order - b.order);
            rest.forEach((row, index) => {
                updated.push({ ...row, order: orderedIds.length + index });
            });
            await db.projects.bulkPut(updated);
            return updated.sort((a, b) => a.order - b.order);
        },

        async relations(id: string): Promise<ProjectRelations> {
            const [noteCount, taskCount] = await Promise.all([
                db.notes.where("projectId").equals(id).count(),
                db.tasks.where("projectId").equals(id).count()
            ]);
            return { noteCount, taskCount };
        },

        async remove(id: string, strategy: ProjectDeleteStrategy): Promise<void> {
            await db.transaction("rw", [db.projects, db.notes, db.tasks], async () => {
                if (strategy === "unassign") {
                    const notes = await db.notes.where("projectId").equals(id).toArray();
                    const tasks = await db.tasks.where("projectId").equals(id).toArray();
                    await db.notes.bulkPut(notes.map((note) => ({ ...note, projectId: null })));
                    await db.tasks.bulkPut(tasks.map((task) => ({ ...task, projectId: null })));
                } else {
                    await db.notes.where("projectId").equals(id).delete();
                    await db.tasks.where("projectId").equals(id).delete();
                }
                await db.projects.delete(id);
            });
        },

        resolveProjectId
    };
}

export type ProjectRepository = ReturnType<typeof projectRepository>;
