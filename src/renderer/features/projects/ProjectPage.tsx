import { useMemo, useState } from "react";
import {
    Archive,
    ArchiveRestore,
    ArrowLeft,
    CheckCircle2,
    FileText,
    MoreHorizontal,
    Pencil,
    Plus,
    Trash2
} from "lucide-react";
import { useStore } from "@/app/store";
import { EmptyState } from "@/components/EmptyState";
import { Popover, PopoverDivider, PopoverItem } from "@/components/Popover";
import { SectionHeader } from "@/components/SectionHeader";
import type { NoteRecord, TaskRecord } from "@/db/schema";
import { sortNotes, sortTasks } from "@/db/schema";
import { formatFullDate } from "@/lib/dates";
import { useWorkflows } from "@/feature-hooks";
import { NotesColumn } from "@/features/notes/NotesColumn";
import { TaskList } from "@/features/tasks/TaskList";

export function ProjectPage({ projectId }: { projectId: string }) {
    const { projects, notes, tasks, ready } = useStore();
    const workflows = useWorkflows();
    const [menuOpen, setMenuOpen] = useState(false);
    const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

    const project = projects.find((row) => row.id === projectId);
    const projectNotes = useMemo(() => sortNotes(notes.filter((note) => note.projectId === projectId)), [notes, projectId]);
    const projectTasks = useMemo(() => sortTasks(tasks.filter((task) => task.projectId === projectId)), [tasks, projectId]);

    if (!ready) {
        return <div className="page-loading" aria-busy="true" />;
    }

    if (!project) {
        return (
            <div className="page">
                <div className="panel">
                    <EmptyState
                        icon={FileText}
                        title="Project not found"
                        description="It may have been deleted or archived."
                        action={
                            <button type="button" className="button button-primary button-small" onClick={() => workflows.go({ name: "home" })}>
                                Back to Home
                            </button>
                        }
                    />
                </div>
            </div>
        );
    }

    const noteList = projectNotes as NoteRecord[];
    const taskList = projectTasks as TaskRecord[];

    return (
        <div className="page project-page">
            <div className="page-topbar">
                <button type="button" className="back-link" onClick={() => workflows.go({ name: "home" })}>
                    <ArrowLeft size={14} strokeWidth={1.9} aria-hidden="true" />
                    Home
                </button>
                <div className="page-topbar-actions">
                    <button
                        type="button"
                        className="button button-ghost button-small"
                        onClick={() => workflows.openProjectDialog({ mode: "edit", projectId: project.id })}
                    >
                        <Pencil size={13} strokeWidth={1.8} aria-hidden="true" />
                        Edit
                    </button>
                    <button
                        type="button"
                        className="icon-button"
                        aria-label="More project actions"
                        aria-haspopup="menu"
                        aria-expanded={menuOpen}
                        onClick={(event) => {
                            setMenuAnchor(event.currentTarget);
                            setMenuOpen((open) => !open);
                        }}
                    >
                        <MoreHorizontal size={16} strokeWidth={2} />
                    </button>
                </div>
            </div>

            <header className="project-header">
                <span className="project-dot project-header-dot" data-color={project.color} aria-hidden="true" />
                <div className="project-header-text">
                    <h1 className="page-title">{project.name}</h1>
                    <p className="page-subtitle">
                        {project.archived ? <span className="badge">Archived</span> : null}
                        Created {formatFullDate(project.createdAt)} · {noteList.length} note
                        {noteList.length === 1 ? "" : "s"} · {taskList.length} task
                        {taskList.length === 1 ? "" : "s"}
                    </p>
                    {project.description ? <p className="project-description">{project.description}</p> : null}
                </div>
            </header>

            <section className="dashboard-section">
                <SectionHeader
                    icon={CheckCircle2}
                    title="Tasks"
                    action={
                        <button
                            type="button"
                            className="text-action"
                            onClick={() => workflows.openTaskDialog(null, project.id)}
                        >
                            <Plus size={13} strokeWidth={2} aria-hidden="true" />
                            New
                        </button>
                    }
                />
                <div className="panel">
                    {taskList.length === 0 ? (
                        <EmptyState
                            icon={CheckCircle2}
                            title="No tasks in this project"
                            description="Add a task to keep this project moving."
                            compact
                            action={
                                <button
                                    type="button"
                                    className="button button-primary button-small"
                                    onClick={() => workflows.openTaskDialog(null, project.id)}
                                >
                                    Add task
                                </button>
                            }
                        />
                    ) : (
                        <TaskList
                            tasks={taskList}
                            showMenu
                            projectNames={new Map()}
                            handlers={{
                                onToggle: workflows.toggleTask,
                                onToggleFavorite: workflows.toggleTaskFavorite,
                                onOpen: (task) => workflows.openTaskDialog(task),
                                onOpenMenu: (task) => workflows.openTaskDialog(task)
                            }}
                        />
                    )}
                </div>
            </section>

            <section className="dashboard-section">
                <SectionHeader
                    icon={FileText}
                    title="Notes"
                    action={
                        <button
                            type="button"
                            className="text-action"
                            onClick={() => {
                                void workflows.createNote({ projectId: project.id, open: true });
                            }}
                        >
                            <Plus size={13} strokeWidth={2} aria-hidden="true" />
                            New
                        </button>
                    }
                />
                {noteList.length === 0 ? (
                    <div className="panel">
                        <EmptyState
                            icon={FileText}
                            title="No notes in this project"
                            description="Capture decisions, research and ideas here."
                            compact
                            action={
                                <button
                                    type="button"
                                    className="button button-primary button-small"
                                    onClick={() => {
                                        void workflows.createNote({ projectId: project.id, open: true });
                                    }}
                                >
                                    Write a note
                                </button>
                            }
                        />
                    </div>
                ) : (
                    <NotesColumn
                        notes={noteList}
                        projects={projects}
                        limit={noteList.length}
                        handlers={{
                            onOpen: (note) => workflows.openNote(note.id),
                            onDelete: workflows.requestDeleteNote,
                            onToggleFlag: workflows.toggleNoteFlag,
                            onMove: workflows.moveNote,
                            onSelectTag: workflows.filterByTag,
                            onReorder: (ids) => {
                                void workflows.reorderNotes(ids);
                            }
                        }}
                    />
                )}
            </section>

            <Popover
                open={menuOpen}
                anchor={menuAnchor}
                onClose={() => setMenuOpen(false)}
                label="Project actions"
            >
                <PopoverItem
                    icon={project.archived ? <ArchiveRestore size={14} strokeWidth={1.8} /> : <Archive size={14} strokeWidth={1.8} />}
                    onSelect={() => {
                        setMenuOpen(false);
                        workflows.toggleProjectArchive(projectId);
                    }}
                >
                    {project.archived ? "Restore project" : "Archive project"}
                </PopoverItem>
                <PopoverDivider />
                <PopoverItem
                    danger
                    icon={<Trash2 size={14} strokeWidth={1.8} />}
                    onSelect={() => {
                        setMenuOpen(false);
                        workflows.requestDeleteProject(project.id);
                    }}
                >
                    Delete project
                </PopoverItem>
            </Popover>
        </div>
    );
}
