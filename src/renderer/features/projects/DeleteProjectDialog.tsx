import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import type { ProjectDeleteStrategy } from "@/db/projectRepository";
import type { ProjectRecord } from "@/db/schema";

export function DeleteProjectDialog({
    project,
    relationCounts,
    onClose,
    onConfirm
}: {
    project: ProjectRecord | null;
    relationCounts: { notes: number; tasks: number };
    onClose: () => void;
    onConfirm: (strategy: ProjectDeleteStrategy) => Promise<void> | void;
}) {
    const [strategy, setStrategy] = useState<ProjectDeleteStrategy>("unassign");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!project) return;
        setStrategy("unassign");
        setBusy(false);
        setError(null);
    }, [project]);

    const totalItems = relationCounts.notes + relationCounts.tasks;

    async function confirm() {
        setBusy(true);
        setError(null);
        try {
            await onConfirm(strategy);
        } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : "Could not delete the project.");
            setBusy(false);
        }
    }

    return (
        <Modal
            open={Boolean(project)}
            size="small"
            title="Delete project?"
            onClose={onClose}
            footer={
                <>
                    <button type="button" className="button button-ghost" onClick={onClose}>
                        Cancel
                    </button>
                    <button type="button" className="button button-danger" data-primary onClick={confirm} disabled={busy}>
                        Delete project
                    </button>
                </>
            }
        >
            <div className="confirm-body">
                <p>
                    <strong>{project?.name}</strong> will be removed from your workspace. This cannot be undone.
                </p>
                {totalItems > 0 ? (
                    <>
                        <p className="confirm-muted">
                            This project contains {relationCounts.notes} note
                            {relationCounts.notes === 1 ? "" : "s"} and {relationCounts.tasks} task
                            {relationCounts.tasks === 1 ? "" : "s"}. Choose what happens to them.
                        </p>
                        <div className="choice-list" role="radiogroup" aria-label="What to do with related items">
                            <label className={`choice${strategy === "unassign" ? " is-selected" : ""}`}>
                                <input
                                    type="radio"
                                    name="delete-strategy"
                                    value="unassign"
                                    checked={strategy === "unassign"}
                                    onChange={() => setStrategy("unassign")}
                                />
                                <span>
                                    <span className="choice-title">Move items to Unassigned</span>
                                    <span className="choice-text">
                                        Keep every note and task and remove their project link.
                                    </span>
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
                                    <span className="choice-title">Delete items as well</span>
                                    <span className="choice-text">
                                        Permanently remove {relationCounts.notes} note
                                        {relationCounts.notes === 1 ? "" : "s"} and {relationCounts.tasks} task
                                        {relationCounts.tasks === 1 ? "" : "s"}.
                                    </span>
                                </span>
                            </label>
                        </div>
                    </>
                ) : (
                    <p className="confirm-muted">This project has no notes or tasks attached.</p>
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
