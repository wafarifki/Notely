import { NotesDatabase } from "@/db/database";
import { createNotesService, type NotesService } from "@/data/service";
import type { ProjectRecord, TaskRecord } from "@/db/schema";

let counter = 0;

export function createTestDatabase(): NotesDatabase {
    counter += 1;
    return new NotesDatabase(`notely-test-${counter}-${Date.now()}`);
}

export async function createTestService(): Promise<{ db: NotesDatabase; service: NotesService }> {
    const db = createTestDatabase();
    const service = createNotesService(db);
    await service.initialize();
    return { db, service };
}

export interface Fixture {
    projects: ProjectRecord[];
    tasks: TaskRecord[];
    notes: { id: string }[];
}

export async function seedFixture(service: NotesService, now: Date = new Date()): Promise<Fixture> {
    const hour = 60 * 60 * 1000;
    const projectNames: Array<[string, "purple" | "green" | "orange" | "yellow" | "pink" | "cyan"]> = [
        ["Workshop planning and ideas", "purple"],
        ["Design exploration", "green"],
        ["Testing results", "pink"],
        ["Users’ feedback", "orange"],
        ["Plans for future", "yellow"]
    ];
    const projects = [];
    for (const [name, color] of projectNames) {
        projects.push(await service.createProject({ name, color }));
    }
    const tasks = [
        await service.createTask({
            title: "Work on the plan",
            notes: "",
            projectId: projects[4].id,
            priority: "high",
            dueAt: new Date(now.getTime() + 3 * hour).toISOString()
        }),
        await service.createTask({
            title: "Collect feedback",
            notes: "",
            projectId: projects[0].id,
            priority: "medium",
            dueAt: new Date(now.getTime() - hour).toISOString()
        }),
        await service.createTask({
            title: "Analyse test results",
            notes: "",
            projectId: projects[2].id,
            priority: "medium",
            dueAt: new Date(now.getTime() + 16 * hour).toISOString()
        })
    ];
    await service.toggleTaskComplete(tasks[1].id);
    await service.toggleTaskFavorite(tasks[0].id);
    const notes = [
        await service.createNote({
            title: "Design challenges",
            content: "Design challenges are exercises that designers can do to boost creativity.",
            projectId: projects[0].id,
            tags: ["Workshops", "Design challenges", "Work in progress"]
        }),
        await service.createNote({
            title: "Note B - Dribbble strategy",
            content: "Shot cadence: three uploads per week.",
            projectId: projects[1].id,
            tags: ["Marketing"]
        }),
        await service.createNote({
            title: "How to conduct a user interview",
            content: "You cannot understand good design if you do not understand people.",
            projectId: projects[3].id,
            tags: ["Needs to be done", "Questions"]
        })
    ];
    return { projects, tasks, notes };
}
