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
import { useI18n } from "@/i18n";
import { NotesColumn } from "@/features/notes/NotesColumn";
import { TaskList } from "@/features/tasks/TaskList";

export function ProjectPage({ projectId }: { projectId: string }) {
    const { projects, notes, tasks, ready } = useStore();
    const workflows = useWorkflows();
    const { t, language } = useI18n();
    const [menuOpen, setMenuOpen] = useState(false);
    const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

    const project = projects.find((row) => row.id === projectId);
    const projectNotes = useMemo(
        () => sortNotes(notes.filter((note) => note.projectId === projectId && !note.archived)),
        [notes, projectId]
    );
    const projectTasks = useMemo(
        () => sortTasks(tasks.filter((task) => task.projectId === projectId && !task.archived)),
        [tasks, projectId]
    );

    if (!ready) {
        return <div className="page-loading" aria-busy="true" />;
    }

    if (!project) {
        return (
            <div className="page">
                <div className="panel">
                    <EmptyState
                        icon={FileText}
                        title={t("project.notFoundTitle")}
                        description={t("project.notFoundText")}
                        action={
                            <button type="button" className="button button-primary button-small" onClick={() => workflows.go({ name: "home" })}>
                                {t("project.backToHome")}
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
                    {t("nav.home")}
                </button>
                <div className="page-topbar-actions">
                    <button
                        type="button"
                        className="button button-ghost button-small"
                        onClick={() => workflows.openProjectDialog({ mode: "edit", projectId: project.id })}
                    >
                        <Pencil size={13} strokeWidth={1.8} aria-hidden="true" />
                        {t("common.edit")}
                    </button>
                    <button
                        type="button"
                        className="icon-button"
                        aria-label={t("project.moreActions")}
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
                        {project.archived ? <span className="badge">{t("common.archived")}</span> : null}
                        {t("project.createdOn", { date: formatFullDate(project.createdAt, language) })} ·{" "}
                        {taskList.length === 1 ? t("project.taskOne") : t("project.tasksMany", { count: taskList.length })} ·{" "}
                        {noteList.length === 1 ? t("project.noteOne") : t("project.notesMany", { count: noteList.length })}
                    </p>
                    {project.description ? <p className="project-description">{project.description}</p> : null}
                </div>
            </header>

            <section className="dashboard-section">
                <SectionHeader
                    icon={CheckCircle2}
                    title={t("common.tasks")}
                    action={
                        <button
                            type="button"
                            className="text-action"
                            onClick={() => workflows.openTaskDialog(null, project.id)}
                        >
                            <Plus size={13} strokeWidth={2} aria-hidden="true" />
                            {t("common.new")}
                        </button>
                    }
                />
                <div className="panel">
                    {taskList.length === 0 ? (
                        <EmptyState
                            icon={CheckCircle2}
                            title={t("project.noTasksTitle")}
                            description={t("project.noTasksText")}
                            compact
                            action={
                                <button
                                    type="button"
                                    className="button button-primary button-small"
                                    onClick={() => workflows.openTaskDialog(null, project.id)}
                                >
                                    {t("project.addTask")}
                                </button>
                            }
                        />
                    ) : (
                        <TaskList
                            tasks={taskList}
                            showMenu
                            padded
                            projectNames={new Map()}
                            handlers={{
                                onToggle: workflows.toggleTask,
                                onToggleFavorite: workflows.toggleTaskFavorite,
                                onOpen: (task) => workflows.openTaskDialog(task),
                                onArchive: (task) => workflows.archiveTask(task, true),
                                onDelete: (task) => workflows.requestDeleteTask(task)
                            }}
                        />
                    )}
                </div>
            </section>

            <section className="dashboard-section">
                <SectionHeader
                    icon={FileText}
                    title={t("common.notes")}
                    action={
                        <button
                            type="button"
                            className="text-action"
                            onClick={() => {
                                void workflows.createNote({ projectId: project.id, open: true });
                            }}
                        >
                            <Plus size={13} strokeWidth={2} aria-hidden="true" />
                            {t("common.new")}
                        </button>
                    }
                />
                {noteList.length === 0 ? (
                    <div className="panel">
                        <EmptyState
                            icon={FileText}
                            title={t("project.noNotesTitle")}
                            description={t("project.noNotesText")}
                            compact
                            action={
                                <button
                                    type="button"
                                    className="button button-primary button-small"
                                    onClick={() => {
                                        void workflows.createNote({ projectId: project.id, open: true });
                                    }}
                                >
                                    {t("common.writeNote")}
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
                            onArchive: (note) => workflows.archiveNote(note, true),
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
                label={t("project.menuLabel")}
            >
                <PopoverItem
                    icon={project.archived ? <ArchiveRestore size={14} strokeWidth={1.8} /> : <Archive size={14} strokeWidth={1.8} />}
                    onSelect={() => {
                        setMenuOpen(false);
                        workflows.toggleProjectArchive(projectId);
                    }}
                >
                    {project.archived ? t("project.restore") : t("project.archive")}
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
                    {t("project.delete")}
                </PopoverItem>
            </Popover>
        </div>
    );
}
