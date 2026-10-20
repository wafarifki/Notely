import { useEffect, useId, useState } from "react";
import { ColorPicker } from "./ColorPicker";
import { Modal } from "./Modal";
import type { ProjectColor, ProjectRecord } from "@/db/schema";

export interface ProjectDialogValues {
    name: string;
    description: string;
    color: ProjectColor;
}

export function ProjectDialog({
    open,
    project,
    suggestedColor,
    onClose,
    onSubmit
}: {
    open: boolean;
    project?: ProjectRecord | null;
    suggestedColor?: ProjectColor;
    onClose: () => void;
    onSubmit: (values: ProjectDialogValues) => Promise<void> | void;
}) {
    const formId = useId();
    const [values, setValues] = useState<ProjectDialogValues>({
        name: "",
        description: "",
        color: "purple"
    });
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!open) return;
        setValues({
            name: project?.name ?? "",
            description: project?.description ?? "",
            color: project?.color ?? suggestedColor ?? "purple"
        });
        setError(null);
        setBusy(false);
    }, [open, project, suggestedColor]);

    const editing = Boolean(project);

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        if (busy) return;
        if (!values.name.trim()) {
            setError("Give the project a name.");
            return;
        }
        setBusy(true);
        try {
            await onSubmit(values);
        } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : "Could not save the project.");
            setBusy(false);
        }
    }

    return (
        <Modal
            open={open}
            size="small"
            title={editing ? "Edit project" : "New project"}
            description={
                editing
                    ? "Update how this project appears in the sidebar and dashboard."
                    : "Projects group related notes and tasks together."
            }
            onClose={onClose}
            footer={
                <>
                    <button type="button" className="button button-ghost" onClick={onClose}>
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form={formId}
                        className="button button-primary"
                        data-primary
                        disabled={busy}
                    >
                        {editing ? "Save changes" : "Create project"}
                    </button>
                </>
            }
        >
            <form id={formId} className="form-stack" onSubmit={handleSubmit} noValidate>
                <label className="field">
                    <span className="field-label">Name</span>
                    <input
                        className="text-input"
                        value={values.name}
                        maxLength={120}
                        autoFocus
                        placeholder="e.g. Workshop planning"
                        onChange={(event) => setValues({ ...values, name: event.target.value })}
                        aria-invalid={Boolean(error) && !values.name.trim()}
                    />
                </label>
                <label className="field">
                    <span className="field-label">Description (optional)</span>
                    <textarea
                        className="text-input text-area"
                        rows={3}
                        maxLength={600}
                        value={values.description}
                        placeholder="What is this project about?"
                        onChange={(event) => setValues({ ...values, description: event.target.value })}
                    />
                </label>
                <ColorPicker value={values.color} onChange={(color) => setValues({ ...values, color })} />
                {error ? (
                    <p className="form-error" role="alert">
                        {error}
                    </p>
                ) : null}
            </form>
        </Modal>
    );
}
