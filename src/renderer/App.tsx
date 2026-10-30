import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DataProvider, describeError, useStore } from "@/app/store";
import { useHashRoute, type Route } from "@/app/router";
import { AppShell } from "@/app/AppShell";
import { UiActionsProvider, type UiActions } from "@/app/ui";
import { WorkflowsProvider, type AppWorkflows } from "@/feature-hooks";
import { ToastProvider, useToast } from "@/components/Toasts";
import { I18nProvider, useI18n, type I18nValue } from "@/i18n";
import { ProjectDialog } from "@/components/ProjectDialog";
import { TaskDialog } from "@/features/tasks/TaskDialog";
import { DeleteProjectDialog } from "@/features/projects/DeleteProjectDialog";
import { DeleteConfirm } from "@/components/DeleteConfirm";
import { SearchOverlay } from "@/features/search/SearchOverlay";
import { TourOverlay } from "@/features/tour/TourOverlay";
import { TourProvider, useUiTour } from "@/features/tour/useUiTour";
import { HomePage } from "@/features/home/HomePage";
import { NotesPage } from "@/features/notes/NotesPage";
import { NoteEditorPage } from "@/features/notes/NoteEditorPage";
import { TasksPage } from "@/features/tasks/TasksPage";
import { ProjectPage } from "@/features/projects/ProjectPage";
import { ActivityPage } from "@/features/activity/ActivityPage";
import { ArchivePage } from "@/features/archive/ArchivePage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { PrivacyPage, SupportPage, WhatsNewPage } from "@/features/info/InfoPages";
import { PRIMARY_COLORS, type NoteRecord, type TaskRecord } from "@/db/schema";
import { getDesktopBridge, type LaunchIntent } from "@/platform/desktop";
import { useLaunchIntent } from "@/platform/launch";

interface ProjectDialogState {
    mode: "create" | "edit";
    projectId?: string;
    onCreated?: (id: string) => void;
}

// ─── NEW: bulk deletes list the affected titles (first three, then a "+N more"
// tail) so the confirm dialog still tells the user what is about to disappear. ───
function bulkDetail<T>(rows: T[], title: (row: T) => string, t: I18nValue["t"]): string | undefined {
    if (rows.length <= 1) return undefined;
    const labels = rows.slice(0, 3).map((row) => `“${title(row)}”`);
    const rest = rows.length - labels.length;
    return `${labels.join(", ")}${rest > 0 ? ` ${t("delete.moreCount", { count: rest })}` : ""}`;
}

function Workspace() {
    const store = useStore();
    const toast = useToast();
    const { t } = useI18n();
    const { route, navigate } = useHashRoute();
    const [searchOpen, setSearchOpen] = useState(false);
    const [projectDialog, setProjectDialog] = useState<ProjectDialogState | null>(null);
    // ─── NEW: pending deletions are arrays so multi-select bulk delete shares
    // the same dialogs and confirm paths as single deletes. ───
    const [deletingProjectIds, setDeletingProjectIds] = useState<string[]>([]);
    const [notesToDelete, setNotesToDelete] = useState<NoteRecord[]>([]);
    const [tasksToDelete, setTasksToDelete] = useState<TaskRecord[]>([]);
    const [taskDialog, setTaskDialog] = useState<{ taskId: string | null; defaultProjectId: string | null } | null>(null);
    const [noteFocusTitle, setNoteFocusTitle] = useState(false);
    // ─── OLD CODE (kept for reference) ───
    // const tour = useUiTour();
    // ─── NEW: the sidebar no longer exposes a tour button; AutoStartTour owns
    // starting the tour and Settings can replay it. ───

    const go = useCallback(
        (next: Route) => {
            if (next.name !== "note") setNoteFocusTitle(false);
            navigate(next);
        },
        [navigate]
    );

    // ─── OLD CODE (kept for reference) ───
    // const toggleProjects = useCallback(() => {
    //     void store.service.settings.update({ projectsExpanded: !store.settings.projectsExpanded });
    // }, [store.settings.projectsExpanded, store.service]);
    // ─── NEW: optimistic sections -------------------------------------------------
    // Flipping `projectsExpanded` used to go straight to IndexedDB and the UI
    // only moved once the write + live query came back (~60-70 ms measured).
    // That made the Projects dropdown feel like it hung after a click. These
    // overrides render the new state immediately; the database catches up in
    // the background and the override is dropped once it agrees. ───
    const [expandedOverride, setExpandedOverride] = useState<boolean | null>(null);
    const [collapsedOverride, setCollapsedOverride] = useState<boolean | null>(null);

    const projectsExpanded = expandedOverride ?? store.settings.projectsExpanded;
    const sidebarCollapsed = collapsedOverride ?? store.settings.sidebarCollapsed;

    useEffect(() => {
        if (expandedOverride !== null && store.settings.projectsExpanded === expandedOverride) {
            setExpandedOverride(null);
        }
    }, [store.settings.projectsExpanded, expandedOverride]);

    useEffect(() => {
        if (collapsedOverride !== null && store.settings.sidebarCollapsed === collapsedOverride) {
            setCollapsedOverride(null);
        }
    }, [store.settings.sidebarCollapsed, collapsedOverride]);

    const toggleSidebar = useCallback(() => {
        const next = !sidebarCollapsed;
        setCollapsedOverride(next);
        store.service.settings
            .update({ sidebarCollapsed: next })
            .catch(() => setCollapsedOverride(null));
    }, [sidebarCollapsed, store.service]);

    const toggleProjects = useCallback(() => {
        const next = !projectsExpanded;
        setExpandedOverride(next);
        store.service.settings
            .update({ projectsExpanded: next })
            .catch(() => setExpandedOverride(null));
    }, [projectsExpanded, store.service]);

    // ─── NEW: open the section outright. Creating a project calls this so the
    // new entry is always visible, even if the section had been collapsed. ───
    const expandProjects = useCallback(() => {
        if (projectsExpanded) return;
        setExpandedOverride(true);
        store.service.settings
            .update({ projectsExpanded: true })
            .catch(() => setExpandedOverride(null));
    }, [projectsExpanded, store.service]);

    const openTaskDialog = useCallback((task?: TaskRecord | null, defaultProjectId?: string | null) => {
        setTaskDialog({ taskId: task?.id ?? null, defaultProjectId: defaultProjectId ?? null });
    }, []);

    const openNote = useCallback(
        (noteId: string, options?: { focusTitle?: boolean }) => {
            setNoteFocusTitle(Boolean(options?.focusTitle));
            go({ name: "note", id: noteId });
        },
        [go]
    );

    const createNote = useCallback(
        async (options?: { projectId?: string | null; open?: boolean }) => {
            try {
                const note = await store.service.createNote({
                    title: "",
                    content: "",
                    projectId: options?.projectId ?? null,
                    tags: []
                });
                toast.success(t("toast.noteCreated"));
                if (options?.open !== false) {
                    openNote(note.id, { focusTitle: true });
                }
                return note;
            } catch (error) {
                toast.error(describeError(error));
                return null;
            }
        },
        [store.service, toast, t, openNote]
    );

    const requestDeleteProject = useCallback((projectId: string) => setDeletingProjectIds([projectId]), []);

    // ─── NEW: multi-select bulk delete. ───
    const requestDeleteProjects = useCallback((projectIds: string[]) => setDeletingProjectIds(projectIds), []);
    const requestDeleteNotes = useCallback((rows: NoteRecord[]) => setNotesToDelete(rows), []);
    const requestDeleteTasks = useCallback((rows: TaskRecord[]) => setTasksToDelete(rows), []);

    // ─── NEW: a `.txt` / `.md` opened through Windows lands here. The main
    // process does the parsing (it has filesystem access); this side decides
    // which note to refresh and takes the user there. ───
    const openImportedDocument = useCallback(
        async (filePath: string) => {
            const bridge = getDesktopBridge();
            if (!bridge) return null;
            try {
                const document = await bridge.readDocument(filePath);
                if (!document) {
                    toast.error(t("toast.fileUnreadable"));
                    return null;
                }
                const { note, created } = await store.service.importDocument({
                    title: document.title,
                    content: document.content,
                    sourcePath: document.sourcePath
                });
                toast.success(t(created ? "toast.fileImported" : "toast.fileRefreshed"));
                openNote(note.id);
                return note;
            } catch (error) {
                toast.error(describeError(error));
                return null;
            }
        },
        [store.service, toast, t, openNote]
    );

    const deleteProject = useCallback(
        async (strategy: "unassign" | "delete") => {
            if (deletingProjectIds.length === 0) return;
            await store.service.deleteProjects(deletingProjectIds, strategy);
            toast.success(
                deletingProjectIds.length === 1
                    ? t(strategy === "unassign" ? "toast.projectDeletedUnassigned" : "toast.projectDeleted")
                    : t("toast.projectsDeleted", { count: deletingProjectIds.length })
            );
            const deletedIds = new Set(deletingProjectIds);
            setDeletingProjectIds([]);
            if (route.name === "project" && deletedIds.has(route.id)) {
                go({ name: "home" });
            }
        },
        [deletingProjectIds, store.service, toast, t, route, go]
    );

    const confirmDeleteNotes = useCallback(async () => {
        if (notesToDelete.length === 0) return;
        try {
            await store.service.deleteNotes(notesToDelete.map((note) => note.id));
            toast.success(
                notesToDelete.length === 1
                    ? t("toast.noteDeleted")
                    : t("toast.notesDeleted", { count: notesToDelete.length })
            );
            const deletedIds = new Set(notesToDelete.map((note) => note.id));
            if (route.name === "note" && deletedIds.has(route.id)) {
                go({ name: "notes" });
            }
        } catch (error) {
            toast.error(describeError(error));
        }
        setNotesToDelete([]);
    }, [notesToDelete, store.service, toast, t, route, go]);

    const confirmDeleteTasks = useCallback(async () => {
        if (tasksToDelete.length === 0) return;
        try {
            await store.service.deleteTasks(tasksToDelete.map((task) => task.id));
            toast.success(
                tasksToDelete.length === 1
                    ? t("toast.taskDeleted")
                    : t("toast.tasksDeleted", { count: tasksToDelete.length })
            );
            const deletedIds = new Set(tasksToDelete.map((task) => task.id));
            if (taskDialog?.taskId && deletedIds.has(taskDialog.taskId)) {
                setTaskDialog(null);
            }
        } catch (error) {
            toast.error(describeError(error));
        }
        setTasksToDelete([]);
    }, [tasksToDelete, store.service, toast, t, taskDialog]);

    const toggleTask = useCallback(
        async (task: TaskRecord) => {
            try {
                await store.service.toggleTaskComplete(task.id);
            } catch (error) {
                toast.error(describeError(error));
            }
        },
        [store.service, toast]
    );

    const toggleTaskFavorite = useCallback(
        async (task: TaskRecord) => {
            try {
                await store.service.toggleTaskFavorite(task.id);
            } catch (error) {
                toast.error(describeError(error));
            }
        },
        [store.service, toast]
    );

    const toggleNoteFlag = useCallback(
        async (note: NoteRecord, flag: "pinned" | "favorite") => {
            try {
                await store.service.toggleNoteFlag(note.id, flag);
                const turningOn = !note[flag];
                toast.success(
                    flag === "pinned"
                        ? t(turningOn ? "toast.notePinned" : "toast.noteUnpinned")
                        : t(turningOn ? "toast.addedFavorite" : "toast.removedFavorite")
                );
            } catch (error) {
                toast.error(describeError(error));
            }
        },
        [store.service, toast, t]
    );

    const moveNote = useCallback(
        async (note: NoteRecord, projectId: string | null) => {
            try {
                await store.service.moveNote(note.id, projectId);
                toast.success(t(projectId ? "toast.noteMoved" : "toast.noteMovedUnassigned"));
            } catch (error) {
                toast.error(describeError(error));
            }
        },
        [store.service, toast, t]
    );

    const openActivityTarget = useCallback(
        (entityType: "project" | "note" | "task", entityId: string | null) => {
            if (!entityId) return;
            if (entityType === "project") {
                if (store.projects.some((project) => project.id === entityId)) go({ name: "project", id: entityId });
                else toast.info(t("toast.projectGone"));
            } else if (entityType === "note") {
                if (store.notes.some((note) => note.id === entityId)) openNote(entityId);
                else toast.info(t("toast.noteGone"));
            } else {
                const task = store.tasks.find((row) => row.id === entityId);
                if (task) openTaskDialog(task);
                else toast.info(t("toast.taskGone"));
            }
        },
        [store.projects, store.notes, store.tasks, go, openNote, openTaskDialog, toast, t]
    );

    const reorderProjects = useCallback(
        async (ids: string[]) => {
            try {
                await store.service.reorderProjects(ids);
            } catch (error) {
                toast.error(describeError(error));
            }
        },
        [store.service, toast]
    );

    const reorderNotes = useCallback(
        async (ids: string[]) => {
            try {
                await store.service.reorderNotes(ids);
            } catch (error) {
                toast.error(describeError(error));
            }
        },
        [store.service, toast]
    );

    const reorderTasks = useCallback(
        async (ids: string[]) => {
            try {
                await store.service.reorderTasks(ids);
            } catch (error) {
                toast.error(describeError(error));
            }
        },
        [store.service, toast]
    );

    // ─── NEW: archive or restore a note. Archived notes leave the active lists
    // but stay available on the Archive page. ───
    const archiveNote = useCallback(
        async (note: NoteRecord, archived: boolean) => {
            try {
                await store.service.archiveNote(note.id, archived);
                toast.success(t(archived ? "toast.noteArchived" : "toast.noteRestored"));
            } catch (error) {
                toast.error(describeError(error));
            }
        },
        [store.service, toast, t]
    );

    // ─── NEW: archive or restore a task. ───
    const archiveTask = useCallback(
        async (task: TaskRecord, archived: boolean) => {
            try {
                await store.service.archiveTask(task.id, archived);
                toast.success(t(archived ? "toast.taskArchived" : "toast.taskRestored"));
            } catch (error) {
                toast.error(describeError(error));
            }
        },
        [store.service, toast, t]
    );

    // ─── OLD CODE (kept for reference) ───
    // const workflows = useMemo<AppWorkflows>(
    //     () => ({
    //         go,
    //         openSearch: () => setSearchOpen(true),
    //         openProjectDialog: (request) => setProjectDialog(request),
    //         requestDeleteProject,
    //         toggleProjectArchive: (projectId) => {
    //             const project = store.projects.find((row) => row.id === projectId);
    //             if (!project) return;
    //             store.service
    //                 .archiveProject(projectId, !project.archived)
    //                 .then(() => toast.success(t(project.archived ? "toast.projectRestored" : "toast.projectArchived")))
    //                 .catch((error: unknown) => toast.error(describeError(error)));
    //         },
    //         openNote,
    //         createNote,
    //         openNoteDialog: (note) => openNote(note.id),
    //         requestDeleteNote: (note) => setNoteToDelete(note),
    //         toggleNoteFlag,
    //         moveNote,
    //         openTaskDialog,
    //         requestDeleteTask: (task) => setTaskToDelete(task),
    //         toggleTask,
    //         toggleTaskFavorite,
    //         reorderTasks,
    //         filterByTag: (tag) => go({ name: "notes", tag }),
    //         reorderNotes,
    //         reorderProjects,
    //         openActivityTarget
    //     }),
    //     [
    //         go, requestDeleteProject, store.projects, store.service, toast, openNote,
    //         createNote, toggleNoteFlag, moveNote, openTaskDialog, toggleTask,
    //         toggleTaskFavorite, reorderTasks, reorderNotes, reorderProjects, openActivityTarget
    //     ]
    // );
    // ─── NEW: adds archiveNote/archiveTask and keeps the project toggle intact. ───
    const workflows = useMemo<AppWorkflows>(
        () => ({
            go,
            openSearch: () => setSearchOpen(true),
            openProjectDialog: (request) => setProjectDialog(request),
            requestDeleteProject,
            requestDeleteProjects,
            toggleProjectArchive: (projectId) => {
                const project = store.projects.find((row) => row.id === projectId);
                if (!project) return;
                store.service
                    .archiveProject(projectId, !project.archived)
                    .then(() => toast.success(t(project.archived ? "toast.projectRestored" : "toast.projectArchived")))
                    .catch((error: unknown) => toast.error(describeError(error)));
            },
            openNote,
            createNote,
            openNoteDialog: (note) => openNote(note.id),
            requestDeleteNote: (note) => setNotesToDelete([note]),
            requestDeleteNotes,
            archiveNote,
            toggleNoteFlag,
            moveNote,
            openTaskDialog,
            requestDeleteTask: (task) => setTasksToDelete([task]),
            requestDeleteTasks,
            archiveTask,
            toggleTask,
            toggleTaskFavorite,
            reorderTasks,
            filterByTag: (tag) => go({ name: "notes", tag }),
            reorderNotes,
            reorderProjects,
            openActivityTarget
        }),
        [
            go,
            requestDeleteProject,
            requestDeleteProjects,
            requestDeleteNotes,
            requestDeleteTasks,
            store.projects,
            store.service,
            toast,
            t,
            openNote,
            createNote,
            archiveNote,
            toggleNoteFlag,
            moveNote,
            openTaskDialog,
            archiveTask,
            toggleTask,
            toggleTaskFavorite,
            reorderTasks,
            reorderNotes,
            reorderProjects,
            openActivityTarget
        ]
    );

    const uiActions = useMemo<UiActions>(
        () => ({ reorderProjects, reorderNotes, reorderTasks }),
        [reorderProjects, reorderNotes, reorderTasks]
    );

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const isMeta = event.ctrlKey || event.metaKey;
            if (isMeta && event.key.toLowerCase() === "k") {
                event.preventDefault();
                setSearchOpen(true);
            }
            if (isMeta && event.key.toLowerCase() === "n" && !event.shiftKey) {
                const target = event.target as HTMLElement;
                if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
                event.preventDefault();
                void createNote({ open: true });
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [createNote]);

    // ─── NEW: Windows shell integration ─────────────────────────────────────
    // "Notely - Create New Task" / "... Notes" open the matching view, and a
    // `.txt` / `.md` opened through Notely becomes (or refreshes) a note.
    // The IPC layer is registered synchronously, but the store needs a beat to
    // read IndexedDB, so intents wait for `store.ready` before touching data. ───
    const pendingLaunchRef = useRef<LaunchIntent | null>(null);
    const [intentTick, setIntentTick] = useState(0);

    const handleLaunchIntent = useCallback(
        (intent: LaunchIntent) => {
            pendingLaunchRef.current = intent;
            setIntentTick((value) => value + 1);
        },
        []
    );
    useLaunchIntent(handleLaunchIntent);

    useEffect(() => {
        if (!intentTick) return;
        if (!store.ready) return;
        const intent = pendingLaunchRef.current;
        if (!intent) return;
        pendingLaunchRef.current = null;

        if (intent.kind === "task") {
            openTaskDialog(null);
            return;
        }
        if (intent.kind === "note") {
            void createNote({ open: true });
            return;
        }
        if (intent.kind === "file") {
            void openImportedDocument(intent.path);
        }
    }, [intentTick, store.ready, openTaskDialog, createNote, openImportedDocument]);

    const deletingProjects = useMemo(
        () => store.projects.filter((project) => deletingProjectIds.includes(project.id)),
        [store.projects, deletingProjectIds]
    );
    const relationCounts = useMemo(() => {
        const idSet = new Set(deletingProjectIds);
        return {
            notes: store.notes.filter((note) => note.projectId !== null && idSet.has(note.projectId)).length,
            tasks: store.tasks.filter((task) => task.projectId !== null && idSet.has(task.projectId)).length
        };
    }, [store.notes, store.tasks, deletingProjectIds]);

    const editingProject = projectDialog?.projectId
        ? store.projects.find((project) => project.id === projectDialog.projectId) ?? null
        : null;
    const activeTask = taskDialog?.taskId ? store.tasks.find((task) => task.id === taskDialog.taskId) ?? null : null;
    const suggestedColor = useMemo(() => {
        const used = new Set(store.projects.filter((project) => !project.archived).map((project) => project.color));
        return PRIMARY_COLORS.find((color) => !used.has(color)) ?? "purple";
    }, [store.projects]);

    // ─── NEW: hand the shell the optimistic values so sidebar toggles paint
    // immediately instead of waiting for the database round-trip. ───
    const shellSettings = useMemo(
        () => ({ ...store.settings, projectsExpanded, sidebarCollapsed }),
        [store.settings, projectsExpanded, sidebarCollapsed]
    );

    return (
        <WorkflowsProvider value={workflows}>
            <UiActionsProvider value={uiActions}>
                {store.error ? (
                    <div className="fatal-banner" role="alert">
                        {t("toast.storageProblem")} {store.error}
                        <button type="button" className="button button-small button-ghost" onClick={() => window.location.reload()}>
                            {t("toast.reload")}
                        </button>
                    </div>
                ) : null}
                <AppShell
                    route={route}
                    navigate={go}
                    settings={shellSettings}
                    onOpenSearch={() => setSearchOpen(true)}
                    onNewProject={() => setProjectDialog({ mode: "create" })}
                    onToggleSidebar={toggleSidebar}
                    onToggleProjects={toggleProjects}
                    onExpandProjects={expandProjects}
                >
                    <main
                        className="app-scroll scroll-area"
                        key={route.name === "note" ? route.id : route.name}
                        data-route={route.name}
                    >
                        {route.name === "home" ? <HomePage /> : null}
                        {route.name === "notes" ? <NotesPage key={route.tag ?? "all"} initialTag={route.tag} /> : null}
                        {route.name === "note" ? (
                            <NoteEditorPage key={route.id} noteId={route.id} focusTitle={noteFocusTitle} />
                        ) : null}
                        {route.name === "tasks" ? <TasksPage /> : null}
                        {route.name === "project" ? <ProjectPage key={route.id} projectId={route.id} /> : null}
                        {route.name === "activity" ? <ActivityPage /> : null}
                        {route.name === "archive" ? <ArchivePage /> : null}
                        {route.name === "settings" ? <SettingsPage /> : null}
                        {route.name === "support" ? <SupportPage /> : null}
                        {route.name === "whats-new" ? <WhatsNewPage /> : null}
                        {route.name === "privacy" ? <PrivacyPage /> : null}
                    </main>
                </AppShell>

                <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
                <TourOverlay />

                <ProjectDialog
                    open={Boolean(projectDialog)}
                    project={editingProject}
                    suggestedColor={suggestedColor}
                    onClose={() => setProjectDialog(null)}
                    onSubmit={async (values) => {
                        if (projectDialog?.mode === "edit" && editingProject) {
                            await store.service.updateProject(editingProject.id, values);
                            toast.success(t("toast.projectUpdated"));
                        } else {
                            const created = await store.service.createProject(values);
                            toast.success(t("toast.projectCreated"));
                            projectDialog?.onCreated?.(created.id);
                        }
                        setProjectDialog(null);
                    }}
                />

                <DeleteProjectDialog
                    projects={deletingProjects}
                    relationCounts={relationCounts}
                    onClose={() => setDeletingProjectIds([])}
                    onConfirm={deleteProject}
                />

                <TaskDialog
                    open={Boolean(taskDialog)}
                    task={activeTask}
                    projects={store.projects}
                    defaultProjectId={taskDialog?.defaultProjectId}
                    onClose={() => setTaskDialog(null)}
                    onSubmit={async (values) => {
                        if (taskDialog?.taskId) {
                            await store.service.updateTask(taskDialog.taskId, values);
                            toast.success(t("toast.taskUpdated"));
                        } else {
                            await store.service.createTask(values);
                            toast.success(t("toast.taskCreated"));
                        }
                        setTaskDialog(null);
                    }}
                    onDelete={
                        activeTask
                            ? () => {
                                  setTasksToDelete([activeTask]);
                              }
                            : undefined
                    }
                />

                <DeleteConfirm
                    open={notesToDelete.length > 0}
                    subject="note"
                    count={notesToDelete.length}
                    detail={
                        notesToDelete.length === 1
                            ? t("delete.noteDetail", {
                                  title: notesToDelete[0].title || t("common.untitledNote")
                              })
                            : bulkDetail(notesToDelete, (note) => note.title || t("common.untitledNote"), t)
                    }
                    onCancel={() => setNotesToDelete([])}
                    onConfirm={() => void confirmDeleteNotes()}
                />

                <DeleteConfirm
                    open={tasksToDelete.length > 0}
                    subject="task"
                    count={tasksToDelete.length}
                    detail={
                        tasksToDelete.length === 1
                            ? t("delete.noteDetail", { title: tasksToDelete[0].title })
                            : bulkDetail(tasksToDelete, (task) => task.title, t)
                    }
                    onCancel={() => setTasksToDelete([])}
                    onConfirm={() => void confirmDeleteTasks()}
                />

            </UiActionsProvider>
        </WorkflowsProvider>
    );
}

function TourRoot() {
    const { navigate } = useHashRoute();
    const store = useStore();

    // ─── OLD CODE (kept for reference) ───
    // const rememberTour = useCallback(() => {
    //     store.service.settings.update({ tourCompleted: true }).catch(() => undefined);
    // }, [store.service]);
    // ─── NEW: the tour also records `hasSeenTour`, which is what stops it from
    // auto-starting again on later launches. ───
    const rememberTour = useCallback(() => {
        store.service.settings
            .update({ tourCompleted: true, hasSeenTour: true })
            .catch(() => undefined);
    }, [store.service]);

    return (
        // ─── NEW: every screen reads its copy through the language provider so
        // switching language re-renders the whole app instantly. ───
        <I18nProvider language={store.settings.language ?? "en"}>
            <TourProvider navigate={navigate} onTourFinished={rememberTour}>
                <Workspace />
                {/* ─── NEW: launch the welcome tour automatically, but only on a
                genuine first launch of a brand-new install. ─── */}
                <AutoStartTour />
            </TourProvider>
        </I18nProvider>
    );
}

/**
 * Starts the product tour once, on the very first launch of a fresh install.
 * `hasSeenTour` is persisted the moment the tour opens, so quitting mid-tour
 * never brings it back on the next start.
 */
function AutoStartTour() {
    const store = useStore();
    const tour = useUiTour();
    const startedRef = useRef(false);

    useEffect(() => {
        if (startedRef.current) return;
        // Wait until the stored settings row has actually loaded. Before that
        // the store falls back to a default profile where hasSeenTour is false,
        // and starting then would show the tour to every returning user.
        if (!store.ready || !store.settingsLoaded) return;
        if (store.settings.hasSeenTour !== false) return;
        startedRef.current = true;
        store.service.settings.update({ hasSeenTour: true }).catch(() => undefined);
        tour.startTour();
    }, [store.ready, store.settingsLoaded, store.settings.hasSeenTour, store.service, tour]);

    return null;
}

export function App() {
    return (
        <ToastProvider>
            <DataProvider>
                <TourRoot />
            </DataProvider>
        </ToastProvider>
    );
}
