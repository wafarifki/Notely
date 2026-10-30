import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import type { ProjectDeleteStrategy } from "@/db/projectRepository";
import type { ProjectRecord } from "@/db/schema";
import { useI18n } from "@/i18n";

export function DeleteProjectDialog({
    projects,
    relationCounts,
    onClose,
    onConfirm
}: {
    // ─── NEW: accepts several projects so multi-select bulk delete reuses the
    // same strategy choice (keep or delete the related notes/tasks). ───
    projects: ProjectRecord[];
    relationCounts: { notes: number; tasks: number };
    onClose: () => void;
    onConfirm: (strategy: ProjectDeleteStrategy) => Promise<void> | void;
}) {
    const [strategy, setStrategy] = useState<ProjectDeleteStrategy>("unassign");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { t } = useI18n();

    const open = projects.length > 0;
    const bulk = projects.length > 1;

    useEffect(() => {
        if (!open) return;
        setStrategy("unassign");
        setBusy(false);
        setError(null);
    }, [open, projects]);

    const totalItems = relationCounts.notes + relationCounts.tasks;
    const notesLabel = relationCounts.notes === 1
        ? t("project.noteOne")
        : t("project.notesMany", { count: relationCounts.notes });
    const tasksLabel = relationCounts.tasks === 1
        ? t("project.taskOne")
        : t("project.tasksMany", { count: relationCounts.tasks });

    async function confirm() {
        setBusy(true);
        setError(null);
        try {
            await onConfirm(strategy);
        } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : t("projectDialog.deleteFailed"));
            setBusy(false);
        }
    }

    return (
        <Modal
            open={open}
            size="small"
            title={bulk ? t("projectDialog.deleteTitlePlural", { count: projects.length }) : t("projectDialog.deleteTitle")}
            onClose={onClose}
            footer={
                <>
                    <button type="button" className="button button-ghost" onClick={onClose}>
                        {t("common.cancel")}
                    </button>
                    <button type="button" className="button button-danger" data-primary onClick={confirm} disabled={busy}>
                        {t("project.delete")}
                    </button>
                </>
            }
        >
            <div className="confirm-body">
                <p>
                    {bulk
                        ? t("projectDialog.deleteBodyPlural", { count: projects.length })
                        : t("projectDialog.deleteBody", { name: projects[0]?.name ?? "" })}
                </p>
                {totalItems > 0 ? (
                    <>
                        <p className="confirm-muted">
                            {bulk
                                ? t("projectDialog.hasItemsPlural", { count: projects.length, notes: notesLabel, tasks: tasksLabel })
                                : t("projectDialog.hasItems", { notes: notesLabel, tasks: tasksLabel })}
                        </p>
                        <div className="choice-list" role="radiogroup" aria-label={t("projectDialog.strategyLabel")}>
                            <label className={`choice${strategy === "unassign" ? " is-selected" : ""}`}>
                                <input
                                    type="radio"
                                    name="delete-strategy"
                                    value="unassign"
                                    checked={strategy === "unassign"}
                                    onChange={() => setStrategy("unassign")}
                                />
                                <span>
                                    <span className="choice-title">{t("projectDialog.keepItems")}</span>
                                    <span className="choice-text">{t("projectDialog.keepItemsText")}</span>
                                </span>
                            </label>
                            <label className={`choice${strategy === "delete" ? " is-selected" : ""}`}>
                                <input
                                    type="radio"
                                    name="delete-strategy"
                                    value="delete"
                                    checked={strategy === "delete"}
                                    onChange={() => setStrategy("delete")}
                                />
                                <span>
                                    <span className="choice-title">{t("projectDialog.deleteItems")}</span>
                                    <span className="choice-text">
                                        {t("projectDialog.deleteItemsText", { notes: notesLabel, tasks: tasksLabel })}
                                    </span>
                                </span>
                            </label>
                        </div>
                    </>
                ) : (
                    <p className="confirm-muted">
                        {bulk ? t("projectDialog.noItemsPlural") : t("projectDialog.noItems")}
                    </p>
                )}
                {error ? (
                    <p className="form-error" role="alert">
                        {error}
                    </p>
                ) : null}
            </div>
        </Modal>
    );
}
