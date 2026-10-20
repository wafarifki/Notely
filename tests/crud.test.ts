import { describe, expect, it } from "vitest";
import { NotesDatabase } from "@/db/database";
import { createNotesService } from "@/data/service";
import { ValidationError } from "@/db/projectRepository";
import { createSeededService, createTestDatabase } from "./helpers";

describe("project CRUD", () => {
    it("creates, updates, archives and reorders projects", async () => {
        const { service } = await createSeededService();
        const created = await service.createProject({ name: "  Roadmap  ", color: "cyan" });
        expect(created.name).toBe("Roadmap");
        expect(created.order).toBe(6);

        const updated = await service.updateProject(created.id, {
            name: "Roadmap 2026",
            color: "pink",
            description: "Quarterly plan"
        });
        expect(updated.name).toBe("Roadmap 2026");
        expect(updated.color).toBe("pink");

        const archived = await service.archiveProject(created.id, true);
        expect(archived.archived).toBe(true);

        const all = await service.projects.list();
        const reordered = await service.reorderProjects([created.id, ...all.filter((p) => p.id !== created.id).map((p) => p.id)]);
        expect(reordered[0].id).toBe(created.id);
        expect(reordered.map((project) => project.order)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    });

    it("rejects empty project names without writing anything", async () => {
        const { service, db } = await createSeededService();
        const before = await db.projects.count();
        await expect(service.createProject({ name: "   ", color: "purple" })).rejects.toBeInstanceOf(ValidationError);
        expect(await db.projects.count()).toBe(before);
    });

    it("moves related notes and tasks to Unassigned when deleting with that strategy", async () => {
        const { service, db } = await createSeededService();
        const project = (await db.projects.toArray()).find((row) => row.name === "Testing results")!;
        const relatedNotes = await db.notes.where("projectId").equals(project.id).toArray();
        const relatedTasks = await db.tasks.where("projectId").equals(project.id).toArray();

        await service.deleteProject(project.id, "unassign");

        expect(await db.projects.get(project.id)).toBeUndefined();
        for (const note of relatedNotes) {
            expect((await db.notes.get(note.id))?.projectId).toBeNull();
        }
        for (const task of relatedTasks) {
            expect((await db.tasks.get(task.id))?.projectId).toBeNull();
        }
    });

    it("deletes related items only when explicitly requested", async () => {
        const { service, db } = await createSeededService();
        const project = (await db.projects.toArray()).find((row) => row.name === "Testing results")!;
        const relatedNoteIds = (await db.notes.where("projectId").equals(project.id).toArray()).map((n) => n.id);
        const relatedTaskIds = (await db.tasks.where("projectId").equals(project.id).toArray()).map((t) => t.id);

        await service.deleteProject(project.id, "delete");

        for (const id of relatedNoteIds) {
            expect(await db.notes.get(id)).toBeUndefined();
        }
        for (const id of relatedTaskIds) {
            expect(await db.tasks.get(id)).toBeUndefined();
        }
    });
});

describe("note CRUD", () => {
    it("creates, edits, moves, pins and deletes notes", async () => {
        const { service, db } = await createSeededService();
        const projects = await db.projects.toArray();
        const note = await service.createNote({
            title: "Fresh idea",
            content: "Something new",
            projectId: null,
            tags: ["  Ideas ", "ideas", "Draft"]
        });
        expect(note.tags).toEqual(["Ideas", "Draft"]);

        const edited = await service.updateNote(note.id, {
            title: "Fresh idea v2",
            content: "Something newer",
            projectId: projects[0].id,
            tags: ["Draft"]
        });
        expect(edited.title).toBe("Fresh idea v2");
        expect(edited.projectId).toBe(projects[0].id);

        const pinned = await service.toggleNoteFlag(note.id, "pinned");
        expect(pinned.pinned).toBe(true);
        const favorited = await service.toggleNoteFlag(note.id, "favorite");
        expect(favorited.favorite).toBe(true);

        const moved = await service.moveNote(note.id, null);
        expect(moved.projectId).toBeNull();

        await service.deleteNote(note.id);
        expect(await db.notes.get(note.id)).toBeUndefined();
    });
});

describe("task CRUD", () => {
    it("creates, edits, completes, favorites and deletes tasks", async () => {
        const { service, db } = await createSeededService();
        const projects = await db.projects.toArray();
        const due = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString();
        const task = await service.createTask({
            title: "Write summary",
            notes: "",
            projectId: projects[1].id,
            priority: "low",
            dueAt: due
        });
        expect(task.completed).toBe(false);

        const edited = await service.updateTask(task.id, {
            title: "Write the summary",
            notes: "Include charts",
            projectId: null,
            priority: "high",
            dueAt: null
        });
        expect(edited.title).toBe("Write the summary");
        expect(edited.priority).toBe("high");
        expect(edited.dueAt).toBeNull();

        const completed = await service.toggleTaskComplete(task.id);
        expect(completed.completed).toBe(true);
        expect(completed.completedAt).not.toBeNull();

        const reopened = await service.toggleTaskComplete(task.id);
        expect(reopened.completed).toBe(false);
        expect(reopened.completedAt).toBeNull();

        const starred = await service.toggleTaskFavorite(task.id);
        expect(starred.favorite).toBe(true);

        await service.deleteTask(task.id);
        expect(await db.tasks.get(task.id)).toBeUndefined();
    });

    it("rejects tasks without a title", async () => {
        const { service, db } = await createSeededService();
        const before = await db.tasks.count();
        await expect(
            service.createTask({ title: " ", notes: "", projectId: null, priority: "medium", dueAt: null })
        ).rejects.toBeInstanceOf(ValidationError);
        expect(await db.tasks.count()).toBe(before);
    });

    it("records activity for task completion", async () => {
        const { service, db } = await createSeededService();
        const task = (await db.tasks.toArray()).find((row) => row.title === "Conclusion")!;
        await service.toggleTaskComplete(task.id);
        const activity = await service.activity.list(5);
        expect(activity[0].kind).toBe("completed");
        expect(activity[0].title).toBe("Conclusion");
        expect(activity[0].entityId).toBe(task.id);
    });
});

describe("persistence", () => {
    it("keeps changes after reopening the database connection", async () => {
        const name = `notes-persist-${Date.now()}`;
        const first = new NotesDatabase(name);
        const firstService = createNotesService(first);
        await firstService.initialize();
        const task = (await firstService.tasks.list())[0];
        await firstService.toggleTaskComplete(task.id);
        const note = await firstService.createNote({ title: "Persisted note", content: "Body", projectId: null, tags: [] });
        first.close();

        const second = new NotesDatabase(name);
        const secondService = createNotesService(second);
        const reopenedTask = await secondService.tasks.get(task.id);
        const reopenedNote = await secondService.notes.get(note.id);

        expect(reopenedTask?.completed).toBe(true);
        expect(reopenedNote?.title).toBe("Persisted note");
        second.close();
        await NotesDatabase.delete(name);
    });

    it("keeps data across two service instances on the same database", async () => {
        const db = createTestDatabase();
        const first = createNotesService(db);
        await first.initialize();
        const created = await first.createProject({ name: "Shared", color: "green" });
        const second = createNotesService(db);
        const projects = await second.projects.list();
        expect(projects.some((project) => project.id === created.id)).toBe(true);
    });
});
