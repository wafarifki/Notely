import { describe, expect, it } from "vitest";
import { ImportValidationError, parseBackup } from "@/db/backup";
import { createSeededService } from "./helpers";

describe("backup export and import", () => {
    it("exports a complete, re-importable snapshot", async () => {
        const { service } = await createSeededService();
        const backup = await service.exportBackup();
        expect(backup.format).toBe("notes-desktop-backup");
        expect(backup.projects).toHaveLength(6);
        expect(backup.notes.length).toBeGreaterThan(0);
        expect(backup.tasks).toHaveLength(5);

        const { backup: parsed, preview } = service.validateImport(JSON.parse(JSON.stringify(backup)));
        expect(preview.projects).toBe(6);
        expect(parsed.tasks).toHaveLength(5);
    });

    it("rejects files that are not backups", () => {
        expect(() => parseBackup({ hello: "world" })).toThrow(ImportValidationError);
        expect(() => parseBackup(null)).toThrow(/expected an object/);
        expect(() => parseBackup({ format: "something-else", version: 1 })).toThrow(/format/);
    });

    it("rejects corrupt records and dangling project references", async () => {
        const { service } = await createSeededService();
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
        const { service, db } = await createSeededService();
        const backup = await service.exportBackup();
        const trimmed = { ...backup, notes: backup.notes.slice(0, 2), tasks: backup.tasks.slice(0, 1), projects: backup.projects.slice(0, 3) };
        const beforeNotes = await db.notes.count();
        await service.applyImport(trimmed, "merge");
        expect(await db.notes.count()).toBe(beforeNotes);
        expect(await db.projects.count()).toBe(6);
    });

    it("replaces the workspace when requested", async () => {
        const { service, db } = await createSeededService();
        const backup = await service.exportBackup();
        const trimmed = { ...backup, notes: backup.notes.slice(0, 1), tasks: [], projects: backup.projects.slice(0, 2) };
        await service.applyImport(trimmed, "replace");
        expect(await db.notes.count()).toBe(1);
        expect(await db.tasks.count()).toBe(0);
        expect(await db.projects.count()).toBe(2);
    });

    it("restores demo data and clears all data on request", async () => {
        const { service, db } = await createSeededService();
        await service.clearAll();
        expect(await db.projects.count()).toBe(0);
        expect(await db.notes.count()).toBe(0);
        expect(await db.tasks.count()).toBe(0);

        await service.restoreDemo();
        expect(await db.projects.count()).toBe(6);
        expect(await db.tasks.count()).toBe(5);
    });
});
