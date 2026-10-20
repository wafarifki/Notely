import { useMemo, useState, type ReactNode } from "react";
import { ArchiveRestore, CheckCircle2, FileText, FolderClosed, Inbox, Trash2 } from "lucide-react";
import { useStore } from "@/app/store";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toasts";
import { formatFullDate } from "@/lib/dates";
import { useWorkflows } from "@/feature-hooks";
import { useI18n } from "@/i18n";
import { describeError } from "@/app/store";
import { sortProjects } from "@/db/schema";

type ArchiveGroup = "project" | "note" | "task";

interface ArchiveTarget {
    group: ArchiveGroup;
    id: string;
    title: string;
}

/**
 * Every archived project, note and task lives here. Restoring simply flips the
 * `archived` flag back to false so the item returns to its original lists.
 */
export function ArchivePage() {
    const { projects, notes, tasks, ready, service } = useStore();
    const workflows = useWorkflows();
    const toast = useToast();
    const { t, language } = useI18n();
    const [pendingDelete, setPendingDelete] = useState<ArchiveTarget | null>(null);
    const [busy, setBusy] = useState(false);

    const archivedProjects = useMemo(
        () => sortProjects(projects.filter((project) => project.archived)),
        [projects]
    );
    const archivedNotes = useMemo(
        () =>
            [...notes]
                .filter((note) => note.archived)
                .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
        [notes]
    );
    const archivedTasks = useMemo(
        () =>
            [...tasks]
                .filter((task) => task.archived)
                .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
        [tasks]
    );

    const total = archivedProjects.length + archivedNotes.length + archivedTasks.length;

    if (!ready) {
        return <div className="page-loading" aria-busy="true" />;
    }

    async function restore(target: ArchiveTarget) {
        try {
            if (target.group === "project") {
                await service.archiveProject(target.id, false);
                toast.success(t("toast.projectRestored"));
            } else if (target.group === "note") {
                await service.archiveNote(target.id, false);
                toast.success(t("toast.noteRestored"));
            } else {
                await service.archiveTask(target.id, false);
                toast.success(t("toast.taskRestored"));
            }
        } catch (error) {
            toast.error(describeError(error));
        }
    }

    async function deleteForever() {
        if (!pendingDelete) return;
        setBusy(true);
        try {
            if (pendingDelete.group === "project") {
                await service.deleteProject(pendingDelete.id, "unassign");
            } else if (pendingDelete.group === "note") {
                await service.deleteNote(pendingDelete.id);
            } else {
                await service.deleteTask(pendingDelete.id);
            }
            setPendingDelete(null);
        } catch (error) {
            toast.error(describeError(error));
        } finally {
            setBusy(false);
        }
    }

    const groups: { key: ArchiveGroup; icon: typeof FolderClosed; label: string; rows: ReactNode[] }[] = [
        {
            key: "project",
            icon: FolderClosed,
            label: t("archive.projects"),
            rows: archivedProjects.map((project) => (
                <ArchiveRow
                    key={project.id}
                    icon={FolderClosed}
                    title={project.name}
                    meta={t("archive.archivedOn", { date: formatFullDate(project.updatedAt, language) })}
                    onOpen={() => workflows.go({ name: "project", id: project.id })}
                    onRestore={() => void restore({ group: "project", id: project.id, title: project.name })}
                    onDelete={() =>
                        setPendingDelete({ group: "project", id: project.id, title: project.name })
                    }
                />
            ))
        },
        {
            key: "note",
            icon: FileText,
            label: t("archive.notes"),
            rows: archivedNotes.map((note) => (
                <ArchiveRow
                    key={note.id}
                    icon={FileText}
                    title={note.title || t("common.untitledNote")}
                    meta={t("archive.archivedOn", { date: formatFullDate(note.updatedAt, language) })}
                    onOpen={() => workflows.openNote(note.id)}
                    onRestore={() => void restore({ group: "note", id: note.id, title: note.title })}
                    onDelete={() => setPendingDelete({ group: "note", id: note.id, title: note.title || t("common.untitledNote") })}
                />
            ))
        },
        {
            key: "task",
            icon: CheckCircle2,
            label: t("archive.tasks"),
            rows: archivedTasks.map((task) => (
                <ArchiveRow
                    key={task.id}
                    icon={CheckCircle2}
                    title={task.title}
                    meta={t("archive.archivedOn", { date: formatFullDate(task.updatedAt, language) })}
                    onOpen={() => workflows.openTaskDialog(task)}
                    onRestore={() => void restore({ group: "task", id: task.id, title: task.title })}
                    onDelete={() => setPendingDelete({ group: "task", id: task.id, title: task.title })}
                />
            ))
        }
    ];

    return (
        <div className="page archive-page">
            <div className="page-topbar">
                <button type="button" className="back-link" onClick={() => workflows.go({ name: "home" })}>
                    <Inbox size={14} strokeWidth={1.9} aria-hidden="true" />
                    {t("nav.home")}
                </button>
            </div>
            <header className="page-header">
                <div>
                    <h1 className="page-title">{t("archive.title")}</h1>
                    <p className="page-subtitle">{t("archive.subtitle")}</p>
                </div>
                <span className="archive-total">
                    {total === 1 ? t("archive.total", { count: total }) : t("archive.totalPlural", { count: total })}
                </span>
            </header>

            {total === 0 ? (
                <div className="panel">
                    <EmptyState icon={Inbox} title={t("archive.empty")} description={t("archive.emptyText")} />
                </div>
            ) : (
                <div className="archive-groups">
                    {groups.map((group) => (
                        <section key={group.key} className="archive-group">
                            <h2 className="archive-group-label">{group.label}</h2>
                            {group.rows.length === 0 ? (
                                <p className="archive-group-empty">{t("archive.emptyGroup")}</p>
                            ) : (
                                <ul className="panel archive-list">{group.rows}</ul>
                            )}
                        </section>
                    ))}
                </div>
            )}

            <ConfirmDialog
                open={pendingDelete !== null}
                title={t("archive.deleteForever")}
                confirmLabel={t("common.delete")}
                tone="danger"
                busy={busy}
                onCancel={() => setPendingDelete(null)}
                onConfirm={() => void deleteForever()}
            >
                <p>{t("delete.noteDetail", { title: pendingDelete?.title ?? "" })}</p>
                <p className="confirm-muted">{t("data.resetCannotUndo")}</p>
            </ConfirmDialog>
        </div>
    );
}

function ArchiveRow({
    icon: Icon,
    title,
    meta,
    onOpen,
    onRestore,
    onDelete
}: {
    icon: typeof FolderClosed;
    title: string;
    meta: string;
    onOpen: () => void;
    onRestore: () => void;
    onDelete: () => void;
}) {
    const { t } = useI18n();
    return (
        <li className="archive-row">
            <span className="archive-row-icon" aria-hidden="true">
                <Icon size={15} strokeWidth={1.8} />
            </span>
            <button type="button" className="archive-row-main" onClick={onOpen}>
                <span className="archive-row-title">{title}</span>
                <span className="archive-row-meta">{meta}</span>
            </button>
            <div className="archive-row-actions">
                <button
                    type="button"
                    className="button button-ghost button-small"
                    onClick={onRestore}
                    title={t("archive.restore")}
                >
                    <ArchiveRestore size={13} strokeWidth={1.9} aria-hidden="true" />
                    {t("archive.restore")}
                </button>
                <button
                    type="button"
                    className="button button-danger-ghost button-small"
                    onClick={onDelete}
                    title={t("archive.deleteForever")}
                >
                    <Trash2 size={13} strokeWidth={1.9} aria-hidden="true" />
                    <span className="sr-only">{t("archive.deleteForever")}</span>
                </button>
            </div>
        </li>
    );
}
