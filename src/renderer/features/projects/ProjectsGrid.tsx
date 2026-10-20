import { useCallback, useMemo, useState } from "react";
import type { ProjectRecord } from "@/db/schema";
import { FolderCard } from "./FolderCard";
import { ProjectMenu, type ProjectMenuActions } from "./ProjectMenu";
import { useProjectDrag } from "./useProjectDrag";

export interface ProjectGridHandlers {
    onOpen(project: ProjectRecord): void;
    onEdit(project: ProjectRecord): void;
    onNewNote(project: ProjectRecord): void;
    onDelete(project: ProjectRecord): void;
    onMove(project: ProjectRecord, direction: -1 | 1): void;
    onReorder(orderedIds: string[]): void;
}

export function ProjectsGrid({
    projects,
    handlers,
    dragEnabled,
    limit,
    className,
    emptySlotLabel = "Drop project here"
}: {
    projects: ProjectRecord[];
    handlers: ProjectGridHandlers;
    dragEnabled: boolean;
    limit?: number;
    className?: string;
    emptySlotLabel?: string;
}) {
    const visible = useMemo(() => (limit ? projects.slice(0, limit) : projects), [projects, limit]);
    const orderedIds = useMemo(() => projects.map((project) => project.id), [projects]);
    const [menuProjectId, setMenuProjectId] = useState<string | null>(null);
    const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
    const drag = useProjectDrag(orderedIds, handlers.onReorder);

    const closeMenu = useCallback(() => {
        setMenuProjectId(null);
        setMenuAnchor(null);
    }, []);

    const menuProject = projects.find((project) => project.id === menuProjectId) ?? null;

    const menuActions: ProjectMenuActions | null = menuProject
        ? {
              onEdit: () => handlers.onEdit(menuProject),
              onNewNote: () => handlers.onNewNote(menuProject),
              onMove: (direction) => handlers.onMove(menuProject, direction),
              canMoveUp: orderedIds.indexOf(menuProject.id) > 0,
              canMoveDown: orderedIds.indexOf(menuProject.id) < orderedIds.length - 1,
              onDelete: () => handlers.onDelete(menuProject)
          }
        : null;

    const targetProject = visible.find((project) => project.id === drag.draggingId);
    const targetIndex = drag.targetIndex;
    const floatingSlot = targetIndex !== null && targetIndex < visible.length ? targetIndex : null;

    return (
        <div className={`projects-grid${drag.draggingId ? " is-sorting" : ""}${className ? ` ${className}` : ""}`}>
            {visible.map((project, index) => {
                const isDragging = drag.draggingId === project.id;
                const showSlot = floatingSlot === index;
                if (isDragging && targetProject) {
                    return (
                        <div key={project.id} className="project-grid-cell">
                            <FolderCard project={targetProject} elevated dragMode ariaPosInSet={index + 1} />
                            <div className="drop-slot" aria-hidden="true" />
                        </div>
                    );
                }
                return (
                    <div key={project.id} className="project-grid-cell">
                        {showSlot ? (
                            <div className="drop-slot" aria-hidden="true">
                                <span>{emptySlotLabel}</span>
                            </div>
                        ) : (
                            <FolderCard
                                project={project}
                                dragMode={false}
                                compact={false}
                                draggable={dragEnabled}
                                menuOpen={menuProjectId === project.id}
                                ariaPosInSet={index + 1}
                                ariaSetSize={visible.length}
                                onOpen={() => handlers.onOpen(project)}
                                onMenu={(anchor) => {
                                    setMenuProjectId(project.id);
                                    setMenuAnchor(anchor);
                                }}
                                onDragStart={(event) => {
                                    event.dataTransfer.effectAllowed = "move";
                                    event.dataTransfer.setData("text/plain", project.id);
                                    const card = event.currentTarget;
                                    event.dataTransfer.setDragImage(card, card.clientWidth / 2, 30);
                                    drag.start(project.id);
                                }}
                                onDragOver={(event) => {
                                    if (!drag.draggingId) return;
                                    event.preventDefault();
                                    event.dataTransfer.dropEffect = "move";
                                    drag.hover(index);
                                }}
                                onDrop={(event) => {
                                    event.preventDefault();
                                    drag.finish(true);
                                }}
                                onDragEnd={() => drag.finish(true)}
                            />
                        )}
                    </div>
                );
            })}
            {menuProject && menuActions ? (
                <ProjectMenu
                    open
                    anchor={menuAnchor}
                    actions={menuActions}
                    onClose={closeMenu}
                />
            ) : null}
        </div>
    );
}
