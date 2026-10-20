import { MoreHorizontal, Pin, Star } from "lucide-react";
import type { NoteRecord, ProjectRecord } from "@/db/schema";
import { formatFullDate } from "@/lib/dates";
// ─── NEW: note bodies are HTML now, so the excerpt strips markup first. ───
import { noteExcerpt } from "@/lib/noteContent";
import { useI18n } from "@/i18n";
import { TagChip } from "./TagChip";

// ─── OLD CODE (kept for reference) ───
// export function noteExcerpt(content: string, max = 260): string {
//     const text = content.replace(/\s+/g, " ").trim();
//     if (text.length <= max) return text;
//     return `${text.slice(0, max).trimEnd()}...`;
// }

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
    const { t, language } = useI18n();
    const noteTitle = note.title || t("common.untitledNote");
    // ─── NEW: the card shows a short preview and a reading cue, so we derive
    // both from the plain-text body once per render. ───
    const preview = noteExcerpt(note.content, 220);
    const hasBody = preview.length > 0;
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
            aria-label={noteTitle}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onDragEnd={onDragEnd}
            onPointerDown={onPointerDown}
            onDoubleClick={() => onOpen?.()}
        >
            {/* ─── OLD CODE (kept for reference) ───
            <div className="note-card-top">
                <span className="note-card-date">…</span>
                <button className="card-menu-button" …>
                    <MoreHorizontal size={15} strokeWidth={2} />
                </button>
            </div>
            <button className="note-card-body">
                <h3 className="note-card-title">{noteTitle}</h3>
                <p className="note-card-excerpt">{noteExcerpt(note.content)}</p>
            </button>
            <div className="note-card-bottom" style={{ minHeight: note.tags.length > 0 ? "30px" : undefined }}>
                …
            </div>
            ─── NEW: the top strip keeps only the status flags (a date on every card
            was noise), the body owns the whole click target, and the footer is a
            single row of tags/project so the card no longer reserves dead space
            under short notes. ─── */}
            <div className="note-card-top">
                <div className="note-card-flags">
                    {note.pinned ? (
                        <span className="note-card-flag" title={t("noteCard.pinned")}>
                            <Pin size={10} strokeWidth={2.2} />
                            <span className="sr-only">{t("noteCard.pinned")}</span>
                        </span>
                    ) : null}
                    {note.favorite ? (
                        <span className="note-card-flag is-favorite" title={t("noteCard.favorite")}>
                            <Star size={10} strokeWidth={2.2} fill="currentColor" />
                            <span className="sr-only">{t("noteCard.favorite")}</span>
                        </span>
                    ) : null}
                </div>
                <span className="note-card-date">{date ?? formatFullDate(note.createdAt, language)}</span>
                <button
                    type="button"
                    className="card-menu-button note-card-menu"
                    aria-label={t("noteCard.actionsFor", { title: noteTitle })}
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
                aria-label={t("noteCard.open", { title: noteTitle })}
                onClick={() => onOpen?.()}
            >
                <h3 className="note-card-title">{noteTitle}</h3>
                {hasBody ? <p className="note-card-excerpt">{preview}</p> : null}
            </button>
            <div className="note-card-bottom">
                <div className="note-card-meta">
                    {note.tags.length > 0 ? (
                        <div className="note-card-tags">
                            {note.tags.slice(0, 3).map((tag) => (
                                <TagChip key={tag} tag={tag} onSelect={onSelectTag} />
                            ))}
                            {note.tags.length > 3 ? (
                                <span className="note-card-tag-more">+{note.tags.length - 3}</span>
                            ) : null}
                        </div>
                    ) : project ? (
                        <span className="note-card-project">
                            <span className="project-dot" data-color={project.color} aria-hidden="true" />
                            {project.name}
                        </span>
                    ) : (
                        <span className="note-card-project is-muted">{t("noteCard.noTags")}</span>
                    )}
                </div>
            </div>
        </article>
    );
}
