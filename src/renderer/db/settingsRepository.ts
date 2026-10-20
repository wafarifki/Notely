import type { NotesDatabase } from "./database";
import type { SettingsRecord } from "./schema";
import { ValidationError } from "./projectRepository";
import { createDefaultProfile } from "./seed";
import { isHexColor } from "@/theme/palette";
import { validationMessage } from "@/lib/validationMessages";

// A 512px square photo encoded as a data URL stays well under this cap.
const MAX_AVATAR_DATA_URL_LENGTH = 1_600_000;

export function settingsRepository(db: NotesDatabase) {
    return {
        async get(): Promise<SettingsRecord> {
            const existing = await db.settings.get("app");
            if (existing) return existing;
            const fallback: SettingsRecord = createDefaultProfile();
            await db.settings.put(fallback);
            return fallback;
        },

        async update(patch: Partial<Omit<SettingsRecord, "id">>): Promise<SettingsRecord> {
            const current = await this.get();
            if (patch.displayName !== undefined) {
                const name = patch.displayName.trim();
                if (!name) {
                    throw new ValidationError(
                        "displayName",
                        validationMessage("validation.displayNameRequired", "Display name is required.")
                    );
                }
                if (name.length > 60) {
                    throw new ValidationError(
                        "displayName",
                        validationMessage("validation.displayNameTooLong", "Display name must be 60 characters or fewer.")
                    );
                }
                patch = { ...patch, displayName: name };
            }
            if (patch.email !== undefined) {
                const email = patch.email.trim();
                const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
                if (!valid) throw new ValidationError("email", validationMessage("validation.email", "Enter a valid email address."));
                patch = { ...patch, email };
            }
            for (const key of ["customAccent", "customCanvas"] as const) {
                const value = patch[key];
                if (value !== undefined && value !== null && !isHexColor(value)) {
                    throw new ValidationError(key, validationMessage("validation.colorHex", "Choose a valid hex color, for example #9a53d2."));
                }
            }
            // ─── NEW: uploaded photos are stored as inline image data URLs.
            // Reject anything that is not a reasonably sized raster image so a
            // corrupt or hostile value can never reach the <img> element.
            if (patch.avatarImage !== undefined && patch.avatarImage !== null) {
                const image = patch.avatarImage;
                const looksValid = /^data:image\/(png|jpe?g|webp|gif|avif);base64,[A-Za-z0-9+/=]+$/.test(image);
                if (!looksValid) {
                    throw new ValidationError("avatarImage", validationMessage("validation.avatarType", "That file is not a supported image."));
                }
                if (image.length > MAX_AVATAR_DATA_URL_LENGTH) {
                    throw new ValidationError("avatarImage", validationMessage("validation.avatarSize", "That image is too large. Choose a smaller photo."));
                }
            }
            if (patch.language !== undefined && patch.language !== "en" && patch.language !== "id") {
                throw new ValidationError("language", validationMessage("validation.language", "Unsupported language."));
            }
            const next = { ...current, ...patch, id: "app" as const };
            await db.settings.put(next);
            return next;
        }
    };
}

export type SettingsRepository = ReturnType<typeof settingsRepository>;
