import { createId } from "@/lib/ids";
import type { NotesDatabase } from "./database";
import { ValidationError } from "./projectRepository";
import type { TaskRecord } from "./schema";

export type TaskPriority = TaskRecord["priority"];

export interface TaskInput {
    title: string;
    notes: string;
    projectId: string | null;
    priority: TaskPriority;
    dueAt: string | null;
}

export const TASK_PRIORITIES: TaskPriority[] = ["low", "medium", "high"];

export function validateTaskInput(input: TaskInput): TaskInput {
    const title = input.title.trim();
    if (!title) {
        throw new ValidationError("title", "Task title is required.");
    }
    if (title.length > 160) {
        throw new ValidationError("title", "Task title must be 160 characters or fewer.");
    }
    if (!TASK_PRIORITIES.includes(input.priority)) {
        throw new ValidationError("priority", "Choose a valid priority.");
    }
    if (input.dueAt && Number.isNaN(new Date(input.dueAt).getTime())) {
        throw new ValidationError("dueAt", "Due date is not a valid date.");
    }
    return {
        title,
        notes: input.notes.slice(0, 2000),
        projectId: input.projectId,
        priority: input.priority,
        dueAt: input.dueAt
    };
}

export function taskRepository(db: NotesDatabase) {
    async function nextOrder(): Promise<number> {
        const rows = await db.tasks.toArray();
        return rows.reduce((max, row) => Math.max(max, row.order), -1) + 1;
    }

    return {
        async list(): Promise<TaskRecord[]> {
            return db.tasks.toArray();
        },

        async get(id: string): Promise<TaskRecord | undefined> {
            return db.tasks.get(id);
        },

        async create(input: TaskInput): Promise<TaskRecord> {
            const data = validateTaskInput(input);
            const now = new Date().toISOString();
            const record: TaskRecord = {
                id: createId("task"),
                title: data.title,
                notes: data.notes,
                projectId: data.projectId,
                completed: false,
                favorite: false,
                priority: data.priority,
                dueAt: data.dueAt,
                order: await nextOrder(),
                createdAt: now,
                updatedAt: now,
                completedAt: null
            };
            await db.tasks.add(record);
            return record;
        },

        async update(id: string, input: TaskInput): Promise<TaskRecord> {
            const data = validateTaskInput(input);
            const existing = await db.tasks.get(id);
            if (!existing) {
                throw new Error("Task no longer exists.");
            }
            const next: TaskRecord = {
                ...existing,
                title: data.title,
                notes: data.notes,
                projectId: data.projectId,
                priority: data.priority,
                dueAt: data.dueAt,
                updatedAt: new Date().toISOString()
            };
            await db.tasks.put(next);
            return next;
        },

        async setCompleted(id: string, completed: boolean): Promise<TaskRecord> {
            const existing = await db.tasks.get(id);
            if (!existing) {
                throw new Error("Task no longer exists.");
            }
            const now = new Date().toISOString();
            const next: TaskRecord = {
                ...existing,
                completed,
                completedAt: completed ? now : null,
                updatedAt: now
            };
            await db.tasks.put(next);
            return next;
        },

        async setFavorite(id: string, favorite: boolean): Promise<TaskRecord> {
            const existing = await db.tasks.get(id);
            if (!existing) {
                throw new Error("Task no longer exists.");
            }
            const next: TaskRecord = { ...existing, favorite, updatedAt: new Date().toISOString() };
            await db.tasks.put(next);
            return next;
        },

        async reorder(orderedIds: string[]): Promise<TaskRecord[]> {
            const rows = await db.tasks.toArray();
            const byId = new Map(rows.map((row) => [row.id, row]));
            const updated: TaskRecord[] = [];
            orderedIds.forEach((id, index) => {
                const row = byId.get(id);
                if (!row) return;
                updated.push({ ...row, order: index });
                byId.delete(id);
            });
            [...byId.values()]
                .sort((a, b) => a.order - b.order)
                .forEach((row, index) => updated.push({ ...row, order: orderedIds.length + index }));
            await db.tasks.bulkPut(updated);
            return updated.sort((a, b) => a.order - b.order);
        },

        async remove(id: string): Promise<void> {
            await db.tasks.delete(id);
        }
    };
}

export type TaskRepository = ReturnType<typeof taskRepository>;
