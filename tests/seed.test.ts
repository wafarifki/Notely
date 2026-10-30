import { describe, expect, it } from "vitest";
import { createDefaultProfile } from "@/db/seed";
import { createTestService } from "./helpers";

describe("fresh install", () => {
    it("starts with an empty workspace and a sensible default profile", async () => {
        const { db, service } = await createTestService();

        expect(await db.projects.count()).toBe(0);
        expect(await db.notes.count()).toBe(0);
        expect(await db.tasks.count()).toBe(0);
        expect(await db.activity.count()).toBe(0);

        const settings = await service.settings.get();
        expect(settings.displayName).toBe("Notely");
        expect(settings.email).toBe("user@user.com");
        expect(settings.theme).toBe("auto");
        expect(settings.accent).toBe("purple");
        expect(settings.tourCompleted).toBe(false);
    });

    it("keeps the existing profile on later starts and never re-creates content", async () => {
        const { db, service } = await createTestService();
        await service.settings.update({ displayName: "Notely Demo", email: "user@user.com" });
        const project = await service.createProject({ name: "Only project", color: "green" });
        await db.notes.add({
            id: "manual-note",
            title: "Manual",
            content: "",
            projectId: project.id,
            tags: [],
            pinned: false,
            favorite: false,
            archived: false,
            order: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });

        await service.initialize();

        expect(await db.projects.count()).toBe(1);
        expect(await db.notes.count()).toBe(1);
        expect((await service.settings.get()).displayName).toBe("Notely Demo");
    });

    it("creates the same default profile on every call without side effects", () => {
        const first = createDefaultProfile();
        const second = createDefaultProfile();
        first.displayName = "changed";
        expect(second.displayName).toBe("Notely");
        expect(second.email).toBe("user@user.com");
    });

    it("resets the workspace but keeps profile and appearance", async () => {
        const { db, service } = await createTestService();
        await service.settings.update({ displayName: "Notely", theme: "dark", accent: "teal" });
        await service.createProject({ name: "Temp", color: "purple" });
        await service.createNote({ title: "Temp note", content: "x", projectId: null, tags: [] });

        await service.clearAll();

        expect(await db.projects.count()).toBe(0);
        expect(await db.notes.count()).toBe(0);
        expect(await db.tasks.count()).toBe(0);
        expect(await db.activity.count()).toBe(0);
        const settings = await service.settings.get();
        expect(settings.theme).toBe("dark");
        expect(settings.accent).toBe("teal");
    });
});
