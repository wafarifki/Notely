import { describe, expect, it } from "vitest";
import { formatDueLabel, isOverdue, ordinal } from "@/lib/dates";
import { searchAll, searchNotes, searchTasks } from "@/lib/search";
import { buildSeedData } from "@/db/seed";
import { splitDashboardTasks, filterTasks } from "@/app/tasks";

const seed = buildSeedData(new Date("2026-01-01T00:00:00.000Z"));

describe("search", () => {
    it("matches note titles, content, project names and tags", () => {
        expect(searchNotes(seed.notes, seed.projects, "dribbble").map((note) => note.title)).toEqual([
            "Note B - Dribbble strategy"
        ]);
        expect(searchNotes(seed.notes, seed.projects, "user interviews").map((note) => note.title)).toEqual([
            "How to conduct a user interview that could improve your product?"
        ]);
        expect(searchNotes(seed.notes, seed.projects, "user interview").map((note) => note.title)).toEqual([
            "How to conduct a user interview that could improve your product?"
        ]);
        expect(
            searchNotes(seed.notes, seed.projects, "design").some((note) => note.tags.includes("Work in progress"))
        ).toBe(true);
        expect(searchNotes(seed.notes, seed.projects, "workshops").map((note) => note.title)).toEqual([
            "Design challenges"
        ]);
    });

    it("requires every token to match", () => {
        expect(searchNotes(seed.notes, seed.projects, "design zzz")).toHaveLength(0);
    });

    it("returns grouped results for tasks and projects as well", () => {
        const results = searchAll("plan", seed.notes, seed.tasks, seed.projects);
        expect(results.projects.map((project) => project.name)).toContain("Workshop planning and ideas");
        expect(results.tasks.map((task) => task.title)).toContain("Work on the plan");
        expect(results.total).toBe(results.projects.length + results.notes.length + results.tasks.length);
    });

    it("finds tasks by title", () => {
        expect(searchTasks(seed.tasks, seed.projects, "analyse").map((task) => task.title)).toEqual([
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
        const { visible, hiddenCount } = splitDashboardTasks(seed.tasks, 5);
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
        expect(filterTasks(seed.tasks, "completed").map((task) => task.title)).toEqual(["Collect feedback"]);
        expect(filterTasks(seed.tasks, "overdue", now).map((task) => task.title)).toEqual([]);
        expect(filterTasks(seed.tasks, "favorite").map((task) => task.title)).toEqual(["Work on the plan"]);
        expect(filterTasks(seed.tasks, "active")).toHaveLength(4);
    });
});
