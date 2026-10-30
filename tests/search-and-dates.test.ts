import { describe, expect, it } from "vitest";
import { formatDueLabel, isOverdue, ordinal } from "@/lib/dates";
import { searchAll, searchNotes, searchTasks } from "@/lib/search";
import { splitDashboardTasks, filterTasks } from "@/app/tasks";
import type { NoteRecord, ProjectRecord, TaskRecord } from "@/db/schema";

function record<T>(value: T): T {
    return value;
}

const createdAt = "2026-01-01T00:00:00.000Z";
const projects: ProjectRecord[] = [
    ["p-workshop", "Workshop planning and ideas", "purple"],
    ["p-design", "Design exploration", "green"],
    ["p-feedback", "Users’ feedback", "orange"]
].map(([id, name, color], index) =>
    record<ProjectRecord>({
        id,
        name,
        description: "",
        color: color as ProjectRecord["color"],
        order: index,
        archived: false,
        createdAt,
        updatedAt: createdAt
    })
);

const note = (
    id: string,
    title: string,
    content: string,
    projectId: string | null,
    tags: string[]
): NoteRecord => ({
    id,
    title,
    content,
    projectId,
    tags,
    pinned: false,
    favorite: false,
    archived: false,
    order: 0,
    createdAt,
    updatedAt: createdAt
});

const notes: NoteRecord[] = [
    note("n-design", "Design challenges", "Exercises that boost creativity.", "p-workshop", [
        "Workshops",
        "Design challenges",
        "Work in progress"
    ]),
    note("n-dribbble", "Note B - Dribbble strategy", "Shot cadence: three uploads per week.", "p-design", ["Marketing"]),
    note(
        "n-interview",
        "How to conduct a user interview that could improve your product?",
        "You cannot understand good design if you do not understand people; design is made for people.",
        "p-feedback",
        ["Needs to be done", "Questions"]
    )
];

const task = (id: string, title: string, order: number, completed: boolean, favorite: boolean, dueAt: string | null): TaskRecord => ({
    id,
    title,
    notes: "",
    projectId: null,
    completed,
    favorite,
    archived: false,
    checklist: [],
    priority: "medium",
    dueAt,
    order,
    createdAt,
    updatedAt: createdAt,
    completedAt: completed ? createdAt : null
});

const tasks: TaskRecord[] = [
    task("t-plan", "Work on the plan", 0, false, true, "2026-01-01T15:00:00.000Z"),
    task("t-feedback", "Collect feedback", 1, true, false, "2026-01-01T11:00:00.000Z"),
    task("t-results", "Analyse test results", 2, false, false, "2026-01-02T04:00:00.000Z"),
    task("t-conclusion", "Conclusion", 3, false, false, "2026-01-02T13:00:00.000Z"),
    task("t-ideas", "Sort all ideas", 4, false, false, "2026-01-02T13:00:00.000Z")
];

describe("search", () => {
    it("matches note titles, content, project names and tags", () => {
        expect(searchNotes(notes, projects, "dribbble").map((note) => note.title)).toEqual([
            "Note B - Dribbble strategy"
        ]);
        expect(searchNotes(notes, projects, "user interview").map((note) => note.title)).toEqual([
            "How to conduct a user interview that could improve your product?"
        ]);
        expect(
            searchNotes(notes, projects, "design").some((note) => note.tags.includes("Work in progress"))
        ).toBe(true);
        expect(searchNotes(notes, projects, "workshops").map((note) => note.title)).toEqual([
            "Design challenges"
        ]);
    });

    it("requires every token to match", () => {
        expect(searchNotes(notes, projects, "design zzz")).toHaveLength(0);
    });

    it("returns grouped results for tasks and projects as well", () => {
        const results = searchAll("plan", notes, tasks, projects);
        expect(results.projects.map((project) => project.name)).toContain("Workshop planning and ideas");
        expect(results.tasks.map((task) => task.title)).toContain("Work on the plan");
        expect(results.total).toBe(results.projects.length + results.notes.length + results.tasks.length);
    });

    it("finds tasks by title", () => {
        expect(searchTasks(tasks, projects, "analyse").map((task) => task.title)).toEqual([
            "Analyse test results"
        ]);
    });
});

describe("due labels", () => {
    const now = new Date("2026-01-01T12:00:00.000Z");

    it("formats hours left, days left and overdue", () => {
        expect(formatDueLabel("2026-01-01T15:00:00.000Z", now)).toBe("3 hours left");
        expect(formatDueLabel("2026-01-01T11:00:00.000Z", now)).toBe("1 hour overdue");
        expect(formatDueLabel("2026-01-01T16:59:00.000Z", now)).toBe("4 hours left");
        expect(formatDueLabel("2026-01-02T13:00:00.000Z", now)).toBe("1 day left");
        expect(formatDueLabel("2026-01-03T12:00:00.000Z", now)).toBe("2 days left");
        expect(formatDueLabel(null, now)).toBe("No due date");
    });

    it("marks past due incomplete tasks as overdue", () => {
        expect(isOverdue("2026-01-01T11:00:00.000Z", false, now)).toBe(true);
        expect(isOverdue("2026-01-01T11:00:00.000Z", true, now)).toBe(false);
        expect(isOverdue(null, false, now)).toBe(false);
    });

    it("adds ordinal suffixes correctly", () => {
        expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 27].map(ordinal)).toEqual([
            "st",
            "nd",
            "rd",
            "th",
            "th",
            "th",
            "th",
            "st",
            "nd",
            "rd",
            "th"
        ]);
    });
});

describe("dashboard task ordering", () => {
    it("keeps the seed order and limits the list to five", () => {
        const { visible, hiddenCount } = splitDashboardTasks(tasks, 5);
        expect(visible.map((task) => task.title)).toEqual([
            "Work on the plan",
            "Collect feedback",
            "Analyse test results",
            "Conclusion",
            "Sort all ideas"
        ]);
        expect(hiddenCount).toBe(0);
    });

    it("filters tasks for the tasks page", () => {
        const now = new Date("2026-01-01T00:00:00.000Z");
        expect(filterTasks(tasks, "completed").map((task) => task.title)).toEqual(["Collect feedback"]);
        expect(filterTasks(tasks, "overdue", now).map((task) => task.title)).toEqual([]);
        expect(filterTasks(tasks, "favorite").map((task) => task.title)).toEqual(["Work on the plan"]);
        expect(filterTasks(tasks, "active")).toHaveLength(4);
    });
});
