import { describe, expect, it } from "vitest";
import { seedIfEmpty } from "@/db/database";
import { buildSeedData } from "@/db/seed";
import { createTestDatabase } from "./helpers";

describe("seed data", () => {
    it("seeds an empty database exactly once with the reference content", async () => {
        const db = createTestDatabase();

        const firstRun = await seedIfEmpty(db);
        const projects = await db.projects.orderBy("order").toArray();
        const notes = await db.notes.toArray();
        const tasks = await db.tasks.orderBy("order").toArray();
        const activity = await db.activity.toArray();

        expect(firstRun).toBe(true);
        expect(projects.map((project) => project.name)).toEqual([
            "Workshop planning and ideas",
            "Design exploration",
            "Users’ feedback",
            "Plans for future and other directions, ideas for improvement",
            "Testing results",
            "Design exploration"
        ]);
        expect(projects.map((project) => project.color)).toEqual([
            "purple",
            "green",
            "orange",
            "yellow",
            "pink",
            "cyan"
        ]);
        expect(new Set(projects.map((project) => project.id)).size).toBe(6);
        expect(notes.map((note) => note.title)).toContain("Note B - Dribbble strategy");
        expect(notes.find((note) => note.title === "Design challenges")?.tags).toEqual([
            "Workshops",
            "Design challenges",
            "Work in progress"
        ]);
        expect(tasks.map((task) => task.title)).toEqual([
            "Work on the plan",
            "Collect feedback",
            "Analyse test results",
            "Conclusion",
            "Sort all ideas"
        ]);
        expect(tasks[0].favorite).toBe(true);
        expect(tasks[1].completed).toBe(true);
        expect(activity).toHaveLength(5);
        expect(activity.map((row) => row.actorName)).toEqual([
            "Maya Hayes",
            "Cassie Melendez",
            "Ronny Schultz",
            "Amanda Finnegan",
            "Rob Houghton"
        ]);
    });

    it("does not overwrite existing user data on later starts", async () => {
        const db = createTestDatabase();
        await seedIfEmpty(db);
        const original = await db.projects.orderBy("order").first();
        expect(original).toBeDefined();

        await db.projects.delete(original!.id);
        const secondRun = await seedIfEmpty(db);
        const remaining = await db.projects.toArray();

        expect(secondRun).toBe(false);
        expect(remaining).toHaveLength(5);
        expect(remaining.some((project) => project.id === original!.id)).toBe(false);
    });

    it("anchors demo due dates to the seed instant so labels look natural", () => {
        const anchor = new Date("2026-01-10T12:00:00.000Z");
        const seed = buildSeedData(anchor);
        const plan = seed.tasks[0];
        const hoursLeft = (new Date(plan.dueAt!).getTime() - anchor.getTime()) / (60 * 60 * 1000);
        expect(hoursLeft).toBe(3);
    });
});
