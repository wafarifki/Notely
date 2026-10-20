import type { NotesDatabase } from "./database";
import type { SettingsRecord } from "./schema";
import { ValidationError } from "./projectRepository";

export function settingsRepository(db: NotesDatabase) {
    return {
        async get(): Promise<SettingsRecord> {
            const existing = await db.settings.get("app");
            if (existing) return existing;
            const fallback: SettingsRecord = {
                id: "app",
                displayName: "Nick Woods",
                email: "nick.woods@gmail.com",
                avatarId: "nick-woods",
                projectsExpanded: true,
                sidebarCollapsed: false,
                demoDragState: true,
                completedTasksVisible: true,
                showWeekends: true
            };
            await db.settings.put(fallback);
            return fallback;
        },

        async update(patch: Partial<Omit<SettingsRecord, "id">>): Promise<SettingsRecord> {
            const current = await this.get();
            if (patch.displayName !== undefined) {
                const name = patch.displayName.trim();
                if (!name) throw new ValidationError("displayName", "Display name is required.");
                if (name.length > 60) {
                    throw new ValidationError("displayName", "Display name must be 60 characters or fewer.");
                }
                patch = { ...patch, displayName: name };
            }
            if (patch.email !== undefined) {
                const email = patch.email.trim();
                const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
                if (!valid) throw new ValidationError("email", "Enter a valid email address.");
                patch = { ...patch, email };
            }
            const next = { ...current, ...patch, id: "app" as const };
            await db.settings.put(next);
            return next;
        }
    };
}

export type SettingsRepository = ReturnType<typeof settingsRepository>;
