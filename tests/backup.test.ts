import { describe, expect, it } from "vitest";
import { ImportValidationError, parseBackup } from "@/db/backup";
import { createTestService, seedFixture } from "./helpers";

describe("backup export and import", () => {
    it("exports a complete, re-importable snapshot", async () => {
        const { service } = await createTestService();
        const fixture = await seedFixture(service);
        const backup = await service.exportBackup();
        expect(backup.format).toBe("notes-desktop-backup");
        expect(backup.projects).toHaveLength(fixture.projects.length);
        expect(backup.notes).toHaveLength(fixture.notes.length);
        expect(backup.tasks).toHaveLength(fixture.tasks.length);

        const { backup: parsed, preview } = service.validateImport(JSON.parse(JSON.stringify(backup)));
        expect(preview.projects).toBe(fixture.projects.length);
        expect(parsed.tasks).toHaveLength(fixture.tasks.length);
    });

    it("rejects files that are not backups", () => {
        expect(() => parseBackup({ hello: "world" })).toThrow(ImportValidationError);
        expect(() => parseBackup(null)).toThrow(/expected an object/);
        expect(() => parseBackup({ format: "something-else", version: 1 })).toThrow(/format/);
    });

    it("rejects corrupt records and dangling project references", async () => {
        const { service } = await createTestService();
        await seedFixture(service);
        const backup = await service.exportBackup();

        const badColor = structuredClone(backup) as unknown as { projects: { color: string }[] };
        badColor.projects[0].color = "neon";
        expect(() => parseBackup(badColor)).toThrow(/color/);

        const badDate = structuredClone(backup) as unknown as { tasks: { dueAt: string }[] };
        badDate.tasks[0].dueAt = "not-a-date";
        expect(() => parseBackup(badDate)).toThrow(/dueAt/);

        const dangling = structuredClone(backup) as unknown as { notes: { projectId: string | null }[] };
        dangling.notes[0].projectId = "missing-project";
        expect(() => parseBackup(dangling)).toThrow(/references a project/);

        const duplicate = structuredClone(backup) as unknown as { projects: { id: string }[] };
        duplicate.projects[1].id = duplicate.projects[0].id;
        expect(() => parseBackup(duplicate)).toThrow(/duplicate project id/);
    });

    it("merges imports without deleting existing data", async () => {
        const { service, db } = await createTestService();
        await seedFixture(service);
        const backup = await service.exportBackup();
        const trimmed = { ...backup, notes: backup.notes.slice(0, 2), tasks: backup.tasks.slice(0, 1), projects: backup.projects.slice(0, 3) };
        const beforeNotes = await db.notes.count();
        await service.applyImport(trimmed, "merge");
        expect(await db.notes.count()).toBe(beforeNotes);
        expect(await db.projects.count()).toBe(backup.projects.length);
    });

    it("replaces the workspace when requested", async () => {
        const { service, db } = await createTestService();
        await seedFixture(service);
        const backup = await service.exportBackup();
        const trimmed = { ...backup, notes: backup.notes.slice(0, 1), tasks: [], projects: backup.projects.slice(0, 2) };
        await service.applyImport(trimmed, "replace");
        expect(await db.notes.count()).toBe(1);
        expect(await db.tasks.count()).toBe(0);
        expect(await db.projects.count()).toBe(2);
    });

    it("backs up appearance settings and clears data on request", async () => {
        const { service, db } = await createTestService();
        await seedFixture(service);
        await service.settings.update({ theme: "dark", accent: "pink", customAccent: "#123456" });

        const backup = await service.exportBackup();
        expect(backup.settings.theme).toBe("dark");
        expect(backup.settings.customAccent).toBe("#123456");

        await service.clearAll();
        expect(await db.projects.count()).toBe(0);
        expect(await db.notes.count()).toBe(0);
        expect(await db.tasks.count()).toBe(0);
        expect((await service.settings.get()).theme).toBe("dark");
    });

    it("rejects invalid appearance values in a backup file", async () => {
        const { service } = await createTestService();
        const backup = await service.exportBackup();
        const corrupt = structuredClone(backup) as unknown as { settings: Record<string, unknown> };
        corrupt.settings.customAccent = "not-a-color";
        expect(() => parseBackup(corrupt)).toThrow(/customAccent/);
    });
});
