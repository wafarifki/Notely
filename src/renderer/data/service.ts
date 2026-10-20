import { activityRepository } from "@/db/activityRepository";
import {
    applyImport as applyBackup,
    exportDatabase,
    parseBackup,
    summarizeImport,
    type BackupFile,
    type ImportMode,
    type ImportPreview
} from "@/db/backup";
import { clearWorkspace, ensureSettings, type NotesDatabase } from "@/db/database";
import { noteRepository, type NoteInput } from "@/db/noteRepository";
import {
    projectRepository,
    type ProjectDeleteStrategy,
    type ProjectInput
} from "@/db/projectRepository";
import { settingsRepository } from "@/db/settingsRepository";
import { taskRepository, type TaskInput } from "@/db/taskRepository";
import type { NoteRecord, ProjectRecord, TaskRecord } from "@/db/schema";
import { htmlToPlainText } from "@/lib/noteContent";

export interface NotesService {
    initialize(): Promise<void>;
    projects: ReturnType<typeof projectRepository>;
    notes: ReturnType<typeof noteRepository>;
    tasks: ReturnType<typeof taskRepository>;
    settings: ReturnType<typeof settingsRepository>;
    activity: ReturnType<typeof activityRepository>;
    createProject(input: ProjectInput): Promise<ProjectRecord>;
    updateProject(id: string, input: ProjectInput): Promise<ProjectRecord>;
    archiveProject(id: string, archived: boolean): Promise<ProjectRecord>;
    // ─── NEW: notes and tasks can be archived too. ───
    archiveNote(id: string, archived: boolean): Promise<NoteRecord>;
    archiveTask(id: string, archived: boolean): Promise<TaskRecord>;
    deleteProject(id: string, strategy: ProjectDeleteStrategy): Promise<void>;
    reorderProjects(orderedIds: string[]): Promise<ProjectRecord[]>;
    createNote(input: NoteInput): Promise<NoteRecord>;
    updateNote(id: string, input: NoteInput): Promise<NoteRecord>;
    // ─── NEW: open a `.txt` / `.md` as a note. Re-opening the same file
    // refreshes its note instead of creating a duplicate. ───
    importDocument(input: {
        title: string;
        content: string;
        sourcePath: string;
    }): Promise<{ note: NoteRecord; created: boolean }>;
    toggleNoteFlag(id: string, flag: "pinned" | "favorite"): Promise<NoteRecord>;
    moveNote(id: string, projectId: string | null): Promise<NoteRecord>;
    deleteNote(id: string): Promise<void>;
    reorderNotes(orderedIds: string[]): Promise<NoteRecord[]>;
    createTask(input: TaskInput): Promise<TaskRecord>;
    updateTask(id: string, input: TaskInput): Promise<TaskRecord>;
    toggleTaskComplete(id: string): Promise<TaskRecord>;
    toggleTaskFavorite(id: string): Promise<TaskRecord>;
    deleteTask(id: string): Promise<void>;
    reorderTasks(orderedIds: string[]): Promise<TaskRecord[]>;
    exportBackup(): Promise<BackupFile>;
    validateImport(payload: unknown): { backup: BackupFile; preview: ImportPreview };
    applyImport(backup: BackupFile, mode: ImportMode): Promise<void>;
    clearAll(): Promise<void>;
    // ─── NEW: wipe only the activity log, leaving all content untouched. ───
    clearActivity(): Promise<void>;
}

function snippet(text: string, fallback = "Untitled"): string {
    // ─── NEW: note bodies may be HTML, so strip tags before building a title. ───
    const cleaned = htmlToPlainText(text).replace(/\s+/g, " ").trim();
    if (!cleaned) return fallback;
    return cleaned.length > 80 ? `${cleaned.slice(0, 77)}...` : cleaned;
}

export function createNotesService(db: NotesDatabase): NotesService {
    const projects = projectRepository(db);
    const notes = noteRepository(db);
    const tasks = taskRepository(db);
    const settings = settingsRepository(db);
    const activity = activityRepository(db);

    return {
        async initialize() {
            await ensureSettings(db);
        },

        projects,
        notes,
        tasks,
        settings,
        activity,

        async createProject(input) {
            const project = await projects.create(input);
            // ─── NEW: projects used to omit the actor, so every entry fell back to
            // the seeded "Nick Woods" demo name. Record the real profile instead. ───
            const actor = await settings.get();
            await activity.add({
                kind: "created",
                entityType: "project",
                entityId: project.id,
                title: project.name,
                projectId: project.id,
                actorId: actor.avatarId, actorImage: actor.avatarImage,
                actorName: actor.displayName
            });
            return project;
        },

        async updateProject(id, input) {
            const project = await projects.update(id, input);
            const actor = await settings.get();
            await activity.add({
                kind: "updated",
                entityType: "project",
                entityId: project.id,
                title: project.name,
                projectId: project.id,
                actorId: actor.avatarId, actorImage: actor.avatarImage,
                actorName: actor.displayName
            });
            return project;
        },

        async archiveProject(id, archived) {
            const project = await projects.setArchived(id, archived);
            const actor = await settings.get();
            await activity.add({
                kind: archived ? "archived" : "updated",
                entityType: "project",
                entityId: project.id,
                title: project.name,
                projectId: project.id,
                actorId: actor.avatarId, actorImage: actor.avatarImage,
                actorName: actor.displayName
            });
            return project;
        },

        // ─── NEW: archive a note, keeping its content and tags intact. ───
        async archiveNote(id, archived) {
            const note = await notes.setArchived(id, archived);
            await activity.add({
                kind: archived ? "archived" : "updated",
                entityType: "note",
                entityId: note.id,
                title: note.title || snippet(note.content),
                projectId: note.projectId,
                actorId: (await settings.get()).avatarId, actorImage: (await settings.get()).avatarImage, actorName: (await settings.get()).displayName
            });
            return note;
        },

        // ─── NEW: archive a task, keeping its due date and priority. ───
        async archiveTask(id, archived) {
            const task = await tasks.setArchived(id, archived);
            await activity.add({
                kind: archived ? "archived" : "updated",
                entityType: "task",
                entityId: task.id,
                title: task.title,
                projectId: task.projectId,
                actorId: (await settings.get()).avatarId, actorImage: (await settings.get()).avatarImage, actorName: (await settings.get()).displayName
            });
            return task;
        },

        async deleteProject(id, strategy) {            const project = await projects.get(id);
            const relatedNotes = await db.notes.where("projectId").equals(id).toArray();
            const relatedTasks = await db.tasks.where("projectId").equals(id).toArray();
            await projects.remove(id, strategy);
            if (strategy === "delete") {
                await activity.removeMany([
                    id,
                    ...relatedNotes.map((note) => note.id),
                    ...relatedTasks.map((task) => task.id)
                ]);
            } else {
                await db.activity
                    .where("entityId")
                    .equals(id)
                    .modify((row) => {
                        row.projectId = null;
                    });
            }
            const actor = await settings.get();
            await activity.add({
                kind: "deleted",
                entityType: "project",
                entityId: null,
                title: project?.name ?? "Project",
                projectId: null,
                actorId: actor.avatarId, actorImage: actor.avatarImage,
                actorName: actor.displayName
            });
        },

        async reorderProjects(orderedIds) {
            return projects.reorder(orderedIds);
        },

        async createNote(input) {
            const note = await notes.create(input);
            await activity.add({
                kind: "created",
                entityType: "note",
                entityId: note.id,
                title: note.title || snippet(note.content),
                projectId: note.projectId,
                actorId: (await settings.get()).avatarId, actorImage: (await settings.get()).avatarImage, actorName: (await settings.get()).displayName
            });
            return note;
        },

        async updateNote(id, input) {
            const before = await notes.get(id);
            const note = await notes.update(id, input);
            let kind: "updated" | "moved" = "updated";
            if (before && before.projectId !== note.projectId) {
                kind = "moved";
            }
            await activity.add({
                kind,
                entityType: "note",
                entityId: note.id,
                title: note.title || snippet(note.content),
                projectId: note.projectId,
                actorId: (await settings.get()).avatarId, actorImage: (await settings.get()).avatarImage, actorName: (await settings.get()).displayName
            });
            return note;
        },

        async toggleNoteFlag(id, flag) {
            const note = await notes.setFlag(id, flag);
            await activity.add({
                kind: flag === "pinned" ? "pinned" : "favorited",
                entityType: "note",
                entityId: note.id,
                title: note.title || snippet(note.content),
                projectId: note.projectId,
                actorId: (await settings.get()).avatarId, actorImage: (await settings.get()).avatarImage, actorName: (await settings.get()).displayName
            });
            return note;
        },

        async moveNote(id, projectId) {
            const note = await notes.moveToProject(id, projectId);
            await activity.add({
                kind: "moved",
                entityType: "note",
                entityId: note.id,
                title: note.title || snippet(note.content),
                projectId: note.projectId,
                actorId: (await settings.get()).avatarId, actorImage: (await settings.get()).avatarImage, actorName: (await settings.get()).displayName
            });
            return note;
        },

        async deleteNote(id) {
            const note = await notes.get(id);
            await notes.remove(id);
            await activity.removeForEntity(id);
            if (note) {
                await activity.add({
                    kind: "deleted",
                    entityType: "note",
                    entityId: null,
                    title: note.title || snippet(note.content),
                    projectId: note.projectId,
                    actorId: (await settings.get()).avatarId, actorImage: (await settings.get()).avatarImage, actorName: (await settings.get()).displayName
                });
            }
        },

        async reorderNotes(orderedIds) {
            return notes.reorder(orderedIds);
        },

        // ─── NEW: file-association import. The repository decides whether this
        // refreshes an existing note or creates a new one. ───
        async importDocument(input) {
            const existing = await notes.findBySourcePath(input.sourcePath);
            const note = await notes.importDocument(input);
            await activity.add({
                kind: existing ? "updated" : "created",
                entityType: "note",
                entityId: note.id,
                title: note.title || snippet(note.content),
                projectId: note.projectId,
                actorId: (await settings.get()).avatarId, actorImage: (await settings.get()).avatarImage, actorName: (await settings.get()).displayName
            });
            return { note, created: !existing };
        },

        async createTask(input) {
            const task = await tasks.create(input);
            await activity.add({
                kind: "created",
                entityType: "task",
                entityId: task.id,
                title: task.title,
                projectId: task.projectId,
                actorId: (await settings.get()).avatarId, actorImage: (await settings.get()).avatarImage, actorName: (await settings.get()).displayName
            });
            return task;
        },

        async updateTask(id, input) {
            const task = await tasks.update(id, input);
            await activity.add({
                kind: "updated",
                entityType: "task",
                entityId: task.id,
                title: task.title,
                projectId: task.projectId,
                actorId: (await settings.get()).avatarId, actorImage: (await settings.get()).avatarImage, actorName: (await settings.get()).displayName
            });
            return task;
        },

        async toggleTaskComplete(id) {
            const existing = await tasks.get(id);
            if (!existing) {
                throw new Error("Task no longer exists.");
            }
            const task = await tasks.setCompleted(id, !existing.completed);
            await activity.add({
                kind: task.completed ? "completed" : "reopened",
                entityType: "task",
                entityId: task.id,
                title: task.title,
                projectId: task.projectId,
                actorId: (await settings.get()).avatarId, actorImage: (await settings.get()).avatarImage, actorName: (await settings.get()).displayName
            });
            return task;
        },

        async toggleTaskFavorite(id) {
            const existing = await tasks.get(id);
            if (!existing) {
                throw new Error("Task no longer exists.");
            }
            const task = await tasks.setFavorite(id, !existing.favorite);
            await activity.add({
                kind: "favorited",
                entityType: "task",
                entityId: task.id,
                title: task.title,
                projectId: task.projectId,
                actorId: (await settings.get()).avatarId, actorImage: (await settings.get()).avatarImage, actorName: (await settings.get()).displayName
            });
            return task;
        },

        async deleteTask(id) {
            const task = await tasks.get(id);
            await tasks.remove(id);
            await activity.removeForEntity(id);
            if (task) {
                await activity.add({
                    kind: "deleted",
                    entityType: "task",
                    entityId: null,
                    title: task.title,
                    projectId: task.projectId,
                    actorId: (await settings.get()).avatarId, actorImage: (await settings.get()).avatarImage, actorName: (await settings.get()).displayName
                });
            }
        },

        async reorderTasks(orderedIds) {
            return tasks.reorder(orderedIds);
        },

        async exportBackup() {
            return exportDatabase(db);
        },

        validateImport(payload) {
            const backup = parseBackup(payload);
            return { backup, preview: summarizeImport(backup, new Set()) };
        },

        async applyImport(backup, mode) {
            const existing = await db.projects.toArray();
            const existingNotes = await db.notes.toArray();
            const existingTasks = await db.tasks.toArray();
            const preview = summarizeImport(
                backup,
                new Set([...existing, ...existingNotes, ...existingTasks].map((row) => row.id))
            );
            await applyBackup(db, backup, mode);
            await activity.add({
                kind: "updated",
                entityType: "project",
                entityId: null,
                title:
                    mode === "replace"
                        ? "Restored workspace from backup"
                        : `Merged backup (${preview.projects + preview.notes + preview.tasks} items)`,
                actorId: (await settings.get()).avatarId, actorImage: (await settings.get()).avatarImage, actorName: (await settings.get()).displayName
            });
        },

        async clearAll() {
            await clearWorkspace(db);
        },

        // ─── NEW: Recent Activity -> "Clear activity". ───
        async clearActivity() {
            await activity.clear();
        }
    };
}
