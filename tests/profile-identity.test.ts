import { describe, expect, it } from "vitest";
import { createTestService } from "./helpers";

/**
 * The activity feed shows "who did it" on every row. Those rows used to store
 * a frozen copy of the actor's name and photo, so changing the profile in
 * Settings left the whole history showing the previous identity.
 *
 * These tests pin the two guarantees that fix it:
 * 1. new rows are written with the current profile;
 * 2. existing rows are re-stamped when the identity changes.
 */
describe("profile identity propagation", () => {
    it("writes the current display name on new activity rows", async () => {
        const { service } = await createTestService();
        await service.settings.update({ displayName: "Wafar" });
        await service.createProject({ name: "Plan", color: "purple" });

        const rows = await service.activity.list();

        expect(rows.length).toBeGreaterThan(0);
        expect(rows.every((row) => row.actorName === "Wafar")).toBe(true);
    });

    it("re-stamps existing rows when the display name changes", async () => {
        const { service } = await createTestService();
        await service.settings.update({ displayName: "Before" });
        await service.createProject({ name: "Plan", color: "purple" });
        await service.createTask({ title: "Task", notes: "", projectId: null, priority: "low", dueAt: null, checklist: [] });

        expect((await service.activity.list()).every((row) => row.actorName === "Before")).toBe(true);

        await service.settings.update({ displayName: "After" });

        const rows = await service.activity.list();

        expect(rows.length).toBeGreaterThan(1);
        expect(rows.every((row) => row.actorName === "After")).toBe(true);
    });

    it("re-stamps the avatar when the profile photo changes", async () => {
        const { service } = await createTestService();
        await service.createProject({ name: "Plan", color: "purple" });

        const photo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
        await service.settings.update({ avatarImage: photo });

        const rows = await service.activity.list();

        expect(rows.length).toBeGreaterThan(0);
        expect(rows.every((row) => row.actorImage === photo)).toBe(true);
    });

    it("re-stamps the avatar id when a different preset is picked", async () => {
        const { service } = await createTestService();
        await service.settings.update({ avatarId: "amanda-finnegan" });
        await service.createProject({ name: "Plan", color: "purple" });

        await service.settings.update({ avatarId: "ronny-schultz" });

        const rows = await service.activity.list();

        expect(rows.length).toBeGreaterThan(0);
        expect(rows.every((row) => row.actorId === "ronny-schultz")).toBe(true);
    });

    it("leaves activity untouched when a non-identity setting changes", async () => {
        const { service } = await createTestService();
        await service.settings.update({ displayName: "Stable" });
        await service.createProject({ name: "Plan", color: "purple" });
        const before = await service.activity.list();

        await service.settings.update({ theme: "dark", sidebarCollapsed: true });

        const after = await service.activity.list();

        // Nothing was rewritten: same rows, same order, same actor snapshot.
        expect(after.map((row) => row.id)).toEqual(before.map((row) => row.id));
        expect(after.every((row) => row.actorName === "Stable")).toBe(true);
    });
});
