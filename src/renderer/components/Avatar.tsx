import amanda from "../../../assets/avatars/amanda-finnegan.png";
import cassie from "../../../assets/avatars/cassie-melendez.png";
import maya from "../../../assets/avatars/maya-hayes.png";
import nick from "../../../assets/avatars/nick-woods.png";
import rob from "../../../assets/avatars/rob-houghton.png";
import ronny from "../../../assets/avatars/ronny-schultz.png";

export const AVATARS: Record<string, { src: string; label: string }> = {
    "nick-woods": { src: nick, label: "Nick Woods" },
    "maya-hayes": { src: maya, label: "Maya Hayes" },
    "cassie-melendez": { src: cassie, label: "Cassie Melendez" },
    "ronny-schultz": { src: ronny, label: "Ronny Schultz" },
    "amanda-finnegan": { src: amanda, label: "Amanda Finnegan" },
    "rob-houghton": { src: rob, label: "Rob Houghton" }
};

export const AVATAR_IDS = Object.keys(AVATARS);

const PALETTE = ["#efe3f7", "#e2eefa", "#e3f4ea", "#fde9e1", "#fbf3d8", "#f6e1ef"];

function initials(name: string): string {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("");
}

export function Avatar({
    id,
    name,
    size = 34,
    className = "",
    image = null
}: {
    id?: string | null;
    name: string;
    size?: number;
    className?: string;
    // ─── NEW: a user-uploaded photo (data URL) wins over the preset avatar. ───
    image?: string | null;
}) {
    const avatar = id ? AVATARS[id] : undefined;
    const style = { width: size, height: size };

    if (image) {
        return (
            <img
                src={image}
                alt=""
                aria-hidden="true"
                className={`profile-avatar ${className}`}
                style={style}
                draggable={false}
            />
        );
    }

    if (avatar) {
        return (
            <img
                src={avatar.src}
                alt=""
                aria-hidden="true"
                className={`profile-avatar ${className}`}
                style={style}
                draggable={false}
            />
        );
    }

    const colorIndex = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % PALETTE.length;
    return (
        <span
            className={`avatar-initials ${className}`}
            style={{ ...style, background: PALETTE[colorIndex] }}
            aria-hidden="true"
        >
            {initials(name)}
        </span>
    );
}

// ─── NEW: keep uploaded photos small and square so the profile picture never
// turns into a stretched blob and the settings row stays under the storage cap. ───
export const AVATAR_UPLOAD_SIZE = 512;

export function readImageFileAsSquareDataUrl(file: File, size = AVATAR_UPLOAD_SIZE): Promise<string> {
    return new Promise((resolve, reject) => {
        if (!file.type.startsWith("image/")) {
            reject(new Error("Choose an image file such as PNG, JPG or WebP."));
            return;
        }
        const url = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => {
            try {
                // Crop to the centred square first, then scale down.
                const side = Math.min(image.naturalWidth, image.naturalHeight);
                const sx = (image.naturalWidth - side) / 2;
                const sy = (image.naturalHeight - side) / 2;
                const canvas = document.createElement("canvas");
                canvas.width = size;
                canvas.height = size;
                const context = canvas.getContext("2d");
                if (!context) throw new Error("Could not process that image.");
                context.drawImage(image, sx, sy, side, side, 0, 0, size, size);
                resolve(canvas.toDataURL("image/png"));
            } catch (error) {
                reject(error instanceof Error ? error : new Error("Could not process that image."));
            } finally {
                URL.revokeObjectURL(url);
            }
        };
        image.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("That image could not be read. Try a different file."));
        };
        image.src = url;
    });
}
