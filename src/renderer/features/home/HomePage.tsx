import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, FileText, FolderClosed, ListChecks, Plus, Sparkles } from "lucide-react";
import { useStore } from "@/app/store";
import { splitDashboardTasks } from "@/app/tasks";
import { EmptyState } from "@/components/EmptyState";
import { SectionHeader } from "@/components/SectionHeader";
import { SelectionBar } from "@/components/SelectionBar";
import { sortProjects, type ProjectRecord } from "@/db/schema";
import { useWorkflows } from "@/feature-hooks";
import { useUiActions } from "@/app/ui";
import { useI18n } from "@/i18n";
import { useUiTour } from "@/features/tour/useUiTour";
import { ActivityPanel } from "@/features/activity/ActivityPanel";
import { NotesColumn } from "@/features/notes/NotesColumn";
import { ProjectsGrid } from "@/features/projects/ProjectsGrid";
import { TaskList } from "@/features/tasks/TaskList";

const WIDE_BREAKPOINT = 800;

function useWideLayout(): boolean {
    const [enabled, setEnabled] = useState(
        () => typeof window.matchMedia !== "function" || window.matchMedia(`(min-width: ${WIDE_BREAKPOINT}px)`).matches
    );
    useEffect(() => {
        const query = window.matchMedia(`(min-width: ${WIDE_BREAKPOINT}px)`);
        const listener = (event: MediaQueryListEvent) => setEnabled(event.matches);
        query.addEventListener("change", listener);
        return () => query.removeEventListener("change", listener);
    }, []);
    return enabled;
}

function WelcomeEmpty() {
    const workflows = useWorkflows();
    const { startTour } = useUiTour();
    const { t } = useI18n();

    const steps = [
        {
            icon: FolderClosed,
            title: t("home.stepProject"),
            text: t("home.stepProjectText")
        },
        {
            icon: FileText,
            title: t("home.stepNote"),
            text: t("home.stepNoteText")
        },
        {
            icon: ListChecks,
            title: t("home.stepTask"),
            text: t("home.stepTaskText")
        }
    ];

    return (
        <section className="welcome-empty" data-tour="empty-state">
            <div className="welcome-empty-card">
                <span className="welcome-empty-badge">
                    <Sparkles size={14} strokeWidth={1.8} aria-hidden="true" />
                    {t("home.emptyBadge")}
                </span>
                <h2 className="welcome-empty-title">{t("home.emptyTitle")}</h2>
                <p className="welcome-empty-text">{t("home.emptyText")}</p>
                <ol className="welcome-empty-steps">
                    {steps.map((step, index) => (
                        <li key={step.title} style={{ animationDelay: `${90 + index * 80}ms` }}>
                            <span className="welcome-empty-step-icon" aria-hidden="true">
                                <step.icon size={16} strokeWidth={1.7} />
                            </span>
                            <span className="welcome-empty-step-text">
                                <strong>{step.title}</strong>
                                <span>{step.text}</span>
                            </span>
                        </li>
                    ))}
                </ol>
                <div className="welcome-empty-actions">
                    <button
                        type="button"
                        className="button button-primary"
                        onClick={() => workflows.openProjectDialog({ mode: "create" })}
                    >
                        <Plus size={15} strokeWidth={2} aria-hidden="true" />
                        {t("home.createFirstProject")}
                    </button>
                    <button
                        type="button"
                        className="button button-ghost"
                        onClick={() => {
                            void workflows.createNote({ open: true });
                        }}
                    >
                        <FileText size={14} strokeWidth={1.8} aria-hidden="true" />
                        {t("common.writeNote")}
                    </button>
                    <button type="button" className="button button-quiet" onClick={startTour}>
                        {t("home.takeTour")}
                    </button>
                </div>
            </div>
        </section>
    );
}

export function HomePage() {
    const { projects, notes, tasks, activity, settings, ready, isFirstRun } = useStore();
    const { reorderProjects } = useUiActions();
    const workflows = useWorkflows();
    const wideLayout = useWideLayout();
    const { t } = useI18n();
    // ─── NEW: multi-select mode for bulk-deleting projects from the dashboard. ───
    const [projectSelectMode, setProjectSelectMode] = useState(false);
    const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());

    const activeProjects = useMemo(() => sortProjects(projects.filter((project) => !project.archived)), [projects]);
    // ─── NEW: archived notes and tasks stay out of the dashboard columns. ───
    const activeNotes = useMemo(() => notes.filter((note) => !note.archived), [notes]);
    const activeTasks = useMemo(() => tasks.filter((task) => !task.archived), [tasks]);
    const dashboardTasks = useMemo(() => {
        const rows = settings.completedTasksVisible
            ? activeTasks
            : activeTasks.filter((task) => !task.completed);
        return splitDashboardTasks(rows, 5);
    }, [activeTasks, settings.completedTasksVisible]);
    const visibleTasks = dashboardTasks.visible;
    const isEmptyWorkspace =
        isFirstRun &&
        activeProjects.length === 0 &&
        activeNotes.length === 0 &&
        activeTasks.length === 0 &&
        activity.length === 0;

    // ─── NEW: selection helpers. The set is pruned when projects change so
    // entries deleted elsewhere never inflate the "N selected" counter. ───
    useEffect(() => {
        setSelectedProjectIds((current) => {
            const next = new Set([...current].filter((id) => projects.some((project) => project.id === id)));
            return next.size === current.size ? current : next;
        });
    }, [projects]);

    const selectedProjects = useMemo(
        () => projects.filter((project) => selectedProjectIds.has(project.id)),
        [projects, selectedProjectIds]
    );
    const allProjectsSelected =
        activeProjects.length > 0 && activeProjects.every((project) => selectedProjectIds.has(project.id));

    function toggleProjectSelectMode() {
        setProjectSelectMode((current) => !current);
        setSelectedProjectIds(new Set());
    }

    function toggleProjectSelected(project: ProjectRecord) {
        setSelectedProjectIds((current) => {
            const next = new Set(current);
            if (next.has(project.id)) next.delete(project.id);
            else next.add(project.id);
            return next;
        });
    }

    function toggleAllProjects() {
        setSelectedProjectIds((current) => {
            const next = new Set(current);
            if (activeProjects.length > 0 && activeProjects.every((project) => next.has(project.id))) {
                activeProjects.forEach((project) => next.delete(project.id));
            } else {
                activeProjects.forEach((project) => next.add(project.id));
            }
            return next;
        });
    }

    if (!ready) {
        return (
            <div className="dashboard-loading" aria-busy="true">
                <div className="skeleton skeleton-title" />
                <div className="skeleton-row">
                    <div className="skeleton skeleton-block" />
                    <div className="skeleton skeleton-block" />
                </div>
            </div>
        );
    }

    const gridHandlers = {
        onOpen: (project: ProjectRecord) => workflows.go({ name: "project", id: project.id }),
        onEdit: (project: ProjectRecord) => workflows.openProjectDialog({ mode: "edit", projectId: project.id }),
        onNewNote: (project: ProjectRecord) => {
            void workflows.createNote({ projectId: project.id, open: true });
        },
        onDelete: (project: ProjectRecord) => workflows.requestDeleteProject(project.id),
        // ─── NEW: archive from the dashboard card menu. ───
        onArchive: (project: ProjectRecord) => workflows.toggleProjectArchive(project.id),
        onMove: (project: ProjectRecord, direction: -1 | 1) => {
            const ids = activeProjects.map((row) => row.id);
            const index = ids.indexOf(project.id);
            const target = index + direction;
            if (target < 0 || target >= ids.length) return;
            const next = [...ids];
            [next[index], next[target]] = [next[target], next[index]];
            void reorderProjects(next);
        },
        onReorder: (orderedIds: string[]) => {
            void reorderProjects(orderedIds);
        }
    };

    return (
        <div className={`dashboard${isEmptyWorkspace ? " is-welcome" : ""}`}>
            <h1 className="welcome-title">
                {isEmptyWorkspace
                    ? t("home.welcomeNew")
                    : t("home.welcomeBack", { name: settings.displayName.split(" ")[0] })}
            </h1>

            {isEmptyWorkspace ? <WelcomeEmpty /> : null}

            <div className="dashboard-grid" data-tour="dashboard-grid">
                <div className="dashboard-column dashboard-column-left">
                    <section className="dashboard-section projects-section">
                        <SectionHeader
                            icon={FolderClosed}
                            title={t("home.myProjects")}
                            action={
                                projectSelectMode ? undefined : (
                                    <div className="section-header-actions">
                                        <button
                                            type="button"
                                            className="text-action"
                                            onClick={toggleProjectSelectMode}
                                            disabled={activeProjects.length === 0}
                                        >
                                            <ListChecks size={13} strokeWidth={2} aria-hidden="true" />
                                            {t("common.selectItems")}
                                        </button>
                                        <button
                                            type="button"
                                            className="text-action"
                                            onClick={() => workflows.openProjectDialog({ mode: "create" })}
                                        >
                                            <Plus size={13} strokeWidth={2} aria-hidden="true" />
                                            {t("common.new")}
                                        </button>
                                    </div>
                                )
                            }
                        />
                        {projectSelectMode ? (
                            <SelectionBar
                                count={selectedProjects.length}
                                total={activeProjects.length}
                                allSelected={allProjectsSelected}
                                onToggleAll={toggleAllProjects}
                                onDelete={() =>
                                    workflows.requestDeleteProjects(selectedProjects.map((project) => project.id))
                                }
                                onExit={toggleProjectSelectMode}
                            />
                        ) : null}
                        {activeProjects.length === 0 ? (
                            <div className="panel" data-tour="projects-empty">
                                <EmptyState
                                    icon={FolderClosed}
                                    title={t("home.noProjectsTitle")}
                                    description={t("home.noProjectsText")}
                                    action={
                                        <button
                                            type="button"
                                            className="button button-primary button-small"
                                            onClick={() => workflows.openProjectDialog({ mode: "create" })}
                                        >
                                            {t("common.newProject")}
                                        </button>
                                    }
                                />
                            </div>
                        ) : (
                            <div data-tour="projects-grid">
                                <ProjectsGrid
                                    projects={activeProjects}
                                    handlers={gridHandlers}
                                    dragEnabled={wideLayout}
                                    // ─── NEW: selecting must reach every project,
                                    // not just the five shown on the dashboard. ───
                                    limit={projectSelectMode ? undefined : 5}
                                    selectMode={projectSelectMode}
                                    selectedIds={selectedProjectIds}
                                    onToggleSelect={toggleProjectSelected}
                                />
                            </div>
                        )}
                    </section>

                    <section className="dashboard-section notes-section" id="dashboard-notes">
                        <SectionHeader
                            icon={FileText}
                            title={t("home.myNotes")}
                            action={
                                <button
                                    type="button"
                                    className="text-action"
                                    onClick={() => {
                                        void workflows.createNote({ open: true });
                                    }}
                                >
                                    <Plus size={13} strokeWidth={2} aria-hidden="true" />
                                    {t("common.new")}
                                </button>
                            }
                        />
                        {activeNotes.length === 0 ? (
                            <div className="panel">
                                <EmptyState
                                    icon={FileText}
                                    title={t("home.noNotesTitle")}
                                    description={t("home.noNotesText")}
                                    action={
                                        <button
                                            type="button"
                                            className="button button-primary button-small"
                                            onClick={() => {
                                                void workflows.createNote({ open: true });
                                            }}
                                        >
                                            {t("common.writeNote")}
                                        </button>
                                    }
                                />
                            </div>
                        ) : (
                            <NotesColumn
                                notes={activeNotes}
                                projects={projects}
                                limit={4}
                                dragEnabled={wideLayout}
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
                </div>

                <div className="dashboard-column dashboard-column-right">
                    <section className="dashboard-section tasks-section" data-tour="tasks-panel">
                        <SectionHeader
                            icon={CheckCircle2}
                            title={t("home.myTasks")}
                            action={
                                <button
                                    type="button"
                                    className="text-action"
                                    onClick={() => workflows.openTaskDialog(null)}
                                >
                                    <Plus size={13} strokeWidth={2} aria-hidden="true" />
                                    {t("common.new")}
                                </button>
                            }
                        />
                        <div className="panel tasks-panel">
                            {visibleTasks.length === 0 ? (
                                <EmptyState
                                    icon={CheckCircle2}
                                    title={t("home.noTasksTitle")}
                                    description={t("home.noTasksText")}
                                    compact
                                />
                            ) : (
                                <TaskList
                                    tasks={visibleTasks}
                                    dense
                                    handlers={{
                                        onToggle: workflows.toggleTask,
                                        onToggleFavorite: workflows.toggleTaskFavorite,
                                        onOpen: (task) => workflows.openTaskDialog(task)
                                    }}
                                />
                            )}
                        </div>
                    </section>
                    <ActivityPanel
                        activity={activity}
                        onOpen={(row) => workflows.openActivityTarget(row.entityType, row.entityId)}
                    />
                </div>
            </div>
        </div>
    );
}
