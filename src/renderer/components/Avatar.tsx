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
    className = ""
}: {
    id?: string | null;
    name: string;
    size?: number;
    className?: string;
}) {
    const avatar = id ? AVATARS[id] : undefined;
    const style = { width: size, height: size };

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
