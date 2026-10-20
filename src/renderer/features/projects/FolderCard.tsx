import { MoreHorizontal } from "lucide-react";
import type { CSSProperties, Ref } from "react";
import type { ProjectRecord } from "@/db/schema";
import { formatFullDate } from "@/lib/dates";
import { useI18n } from "@/i18n";

interface FolderCardProps {
    project: ProjectRecord;
    date?: string;
    compact?: boolean;
    dragMode?: boolean;
    dragging?: boolean;
    elevated?: boolean;
    style?: CSSProperties;
    cardRef?: Ref<HTMLElement>;
    menuOpen?: boolean;
    onOpen?: () => void;
    onMenu?: (anchor: HTMLElement) => void;
    onPointerDown?: (event: React.PointerEvent<HTMLElement>) => void;
    onDragStart?: (event: React.DragEvent<HTMLElement>) => void;
    onDragOver?: (event: React.DragEvent<HTMLElement>) => void;
    onDrop?: (event: React.DragEvent<HTMLElement>) => void;
    onDragEnd?: () => void;
    draggable?: boolean;
    ariaPosInSet?: number;
    ariaSetSize?: number;
    slotLabel?: string;
}

export function FolderCard({
    project,
    date,
    compact,
    dragMode,
    dragging,
    elevated,
    style,
    cardRef,
    menuOpen,
    onOpen,
    onMenu,
    onPointerDown,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
    draggable,
    ariaPosInSet,
    ariaSetSize,
    slotLabel
}: FolderCardProps) {
    const { t, language } = useI18n();
    const displayDate = date ?? formatFullDate(project.createdAt, language);
    const classes = [
        "folder-card",
        dragging ? "is-dragging" : "",
        elevated ? "is-elevated" : "",
        dragMode ? "is-floating" : "",
        compact ? "is-compact" : "",
        menuOpen ? "is-menu-open" : ""
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <article
            ref={cardRef}
            className={classes}
            style={style}
            draggable={draggable}
            data-project-id={project.id}
            aria-label={project.name}
            aria-roledescription={t("project.cardRole")}
            aria-posinset={ariaPosInSet}
            aria-setsize={ariaSetSize}
            onPointerDown={onPointerDown}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onDragEnd={onDragEnd}
            onDoubleClick={onOpen}
        >
            <div className="folder-card-face">
                <button
                    type="button"
                    className="folder-card-body"
                    onClick={(event) => {
                        if (dragging) {
                            event.preventDefault();
                            return;
                        }
                        onOpen?.();
                    }}
                >
                    <span className="folder-card-title-row">
                        <span className="project-dot" data-color={project.color} aria-hidden="true" />
                        <span className="folder-card-title">{project.name}</span>
                    </span>
                </button>
                {slotLabel ? (
                    <span className="folder-card-slot-hint" aria-hidden="true">
                        {slotLabel}
                    </span>
                ) : null}
                <div className="folder-card-footer">
                    <span className="folder-card-date">{displayDate}</span>
                    <button
                        type="button"
                        className="card-menu-button"
                        aria-label={t("project.actionsFor", { name: project.name })}
                        aria-haspopup="menu"
                        aria-expanded={menuOpen ? "true" : "false"}
                        onClick={(event) => {
                            event.stopPropagation();
                            onMenu?.(event.currentTarget);
                        }}
                    >
                        <MoreHorizontal size={15} strokeWidth={2} />
                    </button>
                </div>
            </div>
        </article>
    );
}
