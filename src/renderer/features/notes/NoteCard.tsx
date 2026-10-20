import { MoreHorizontal, Pin, Star } from "lucide-react";
import type { NoteRecord, ProjectRecord } from "@/db/schema";
import { formatFullDate } from "@/lib/dates";
import { TagChip } from "./TagChip";

export function noteExcerpt(content: string, max = 260): string {
    const text = content.replace(/\s+/g, " ").trim();
    if (text.length <= max) return text;
    return `${text.slice(0, max).trimEnd()}...`;
}

export function NoteCard({
    note,
    project,
    className = "",
    style,
    dragMode,
    dragging,
    elevated,
    menuOpen,
    draggable,
    onOpen,
    onMenu,
    onSelectTag,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
    onPointerDown,
    cardRef,
    date
}: {
    note: NoteRecord;
    project?: ProjectRecord;
    className?: string;
    style?: React.CSSProperties;
    dragMode?: boolean;
    dragging?: boolean;
    elevated?: boolean;
    menuOpen?: boolean;
    draggable?: boolean;
    onOpen?: () => void;
    onMenu?: (anchor: HTMLElement) => void;
    onSelectTag?: (tag: string) => void;
    onDragStart?: (event: React.DragEvent<HTMLElement>) => void;
    onDragOver?: (event: React.DragEvent<HTMLElement>) => void;
    onDrop?: (event: React.DragEvent<HTMLElement>) => void;
    onDragEnd?: () => void;
    onPointerDown?: (event: React.PointerEvent<HTMLElement>) => void;
    cardRef?: React.Ref<HTMLElement>;
    date?: string;
}) {
    const classes = [
        "note-card",
        dragMode ? "is-floating" : "",
        dragging ? "is-dragging" : "",
        elevated ? "is-elevated" : "",
        menuOpen ? "is-menu-open" : "",
        className
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <article
            ref={cardRef}
            className={classes}
            style={style}
            draggable={draggable}
            data-note-id={note.id}
            aria-label={note.title || "Untitled note"}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onDragEnd={onDragEnd}
            onPointerDown={onPointerDown}
            onDoubleClick={() => onOpen?.()}
        >
            <div className="note-card-top">
                <span className="note-card-date">
                    {date ?? formatFullDate(note.createdAt)}
                    {note.pinned ? (
                        <span className="note-card-flag" title="Pinned">
                            <Pin size={10} strokeWidth={2.2} />
                            <span className="sr-only">Pinned</span>
                        </span>
                    ) : null}
                    {note.favorite ? (
                        <span className="note-card-flag is-favorite" title="Favorite">
                            <Star size={10} strokeWidth={2.2} fill="currentColor" />
                            <span className="sr-only">Favorite</span>
                        </span>
                    ) : null}
                </span>
                <button
                    type="button"
                    className="card-menu-button"
                    aria-label={`Note actions for ${note.title || "Untitled note"}`}
                    aria-haspopup="menu"
                    aria-expanded={menuOpen ? "true" : "false"}
                    onClick={(event) => onMenu?.(event.currentTarget)}
                >
                    <MoreHorizontal size={15} strokeWidth={2} />
                </button>
            </div>
            <button
                type="button"
                className="note-card-body"
                aria-label={`Open note: ${note.title || "Untitled note"}`}
                onClick={() => onOpen?.()}
            >
                <h3 className="note-card-title">{note.title || "Untitled note"}</h3>
                <p className="note-card-excerpt">{noteExcerpt(note.content)}</p>
            </button>
            <div
                className="note-card-bottom"
                style={{ minHeight: note.tags.length > 0 ? "30px" : undefined }}
            >
                {note.tags.length > 0 ? (
                    <div className="note-card-tags">
                        {note.tags.map((tag) => (
                            <TagChip key={tag} tag={tag} onSelect={onSelectTag} />
                        ))}
                    </div>
                ) : project ? (
                    <span className="note-card-project">
                        <span className="project-dot" data-color={project.color} aria-hidden="true" />
                        {project.name}
                    </span>
                ) : null}
            </div>
        </article>
    );
}
