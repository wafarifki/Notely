import { useEffect, useId, useState } from "react";
import { Modal } from "@/components/Modal";
import type { TaskInput, TaskPriority } from "@/db/taskRepository";
import type { ProjectRecord, TaskRecord } from "@/db/schema";
import { fromDateTimeInputValue, toDateTimeInputValue } from "@/lib/dates";

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
    { value: "low", label: "Low" },
    { value: "medium", label: "Medium" },
    { value: "high", label: "High" }
];

interface TaskFormValues {
    title: string;
    notes: string;
    projectId: string;
    priority: TaskPriority;
    due: string;
}

export function TaskDialog({
    open,
    task,
    projects,
    defaultProjectId,
    onClose,
    onSubmit,
    onDelete
}: {
    open: boolean;
    task?: TaskRecord | null;
    projects: ProjectRecord[];
    defaultProjectId?: string | null;
    onClose: () => void;
    onSubmit: (values: TaskInput) => Promise<void> | void;
    onDelete?: () => void;
}) {
    const formId = useId();
    const [values, setValues] = useState<TaskFormValues>({
        title: "",
        notes: "",
        projectId: "",
        priority: "medium",
        due: ""
    });
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!open) return;
        setValues({
            title: task?.title ?? "",
            notes: task?.notes ?? "",
            projectId: task?.projectId ?? defaultProjectId ?? "",
            priority: task?.priority ?? "medium",
            due: toDateTimeInputValue(task?.dueAt ?? null)
        });
        setError(null);
        setBusy(false);
    }, [open, task, defaultProjectId]);

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        if (busy) return;
        if (!values.title.trim()) {
            setError("Give the task a title.");
            return;
        }
        setBusy(true);
        try {
            await onSubmit({
                title: values.title,
                notes: values.notes,
                projectId: values.projectId || null,
                priority: values.priority,
                dueAt: fromDateTimeInputValue(values.due)
            });
        } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : "Could not save the task.");
            setBusy(false);
        }
    }

    const activeProjects = projects.filter((project) => !project.archived || project.id === task?.projectId);

    return (
        <Modal
            open={open}
            size="small"
            title={task ? "Edit task" : "New task"}
            onClose={onClose}
            footer={
                <>
                    {task && onDelete ? (
                        <button type="button" className="button button-danger-ghost" onClick={onDelete}>
                            Delete
                        </button>
                    ) : null}
                    <span className="modal-footer-spacer" />
                    <button type="button" className="button button-ghost" onClick={onClose}>
                        Cancel
                    </button>
                    <button type="submit" form={formId} className="button button-primary" data-primary disabled={busy}>
                        {task ? "Save changes" : "Add task"}
                    </button>
                </>
            }
        >
            <form id={formId} className="form-stack" onSubmit={handleSubmit} noValidate>
                <label className="field">
                    <span className="field-label">Title</span>
                    <input
                        className="text-input"
                        value={values.title}
                        maxLength={160}
                        autoFocus
                        placeholder="What needs to be done?"
                        onChange={(event) => setValues({ ...values, title: event.target.value })}
                        aria-invalid={Boolean(error) && !values.title.trim()}
                    />
                </label>
                <div className="field-row">
                    <label className="field">
                        <span className="field-label">Project</span>
                        <select
                            className="text-input select-input"
                            value={values.projectId}
                            onChange={(event) => setValues({ ...values, projectId: event.target.value })}
                        >
                            <option value="">Unassigned</option>
                            {activeProjects.map((project) => (
                                <option key={project.id} value={project.id}>
                                    {project.name}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="field">
                        <span className="field-label">Priority</span>
                        <select
                            className="text-input select-input"
                            value={values.priority}
                            onChange={(event) =>
                                setValues({ ...values, priority: event.target.value as TaskPriority })
                            }
                        >
                            {PRIORITY_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
                <label className="field">
                    <span className="field-label">Due date</span>
                    <input
                        type="datetime-local"
                        className="text-input"
                        value={values.due}
                        onChange={(event) => setValues({ ...values, due: event.target.value })}
                    />
                    <span className="field-hint">Deadline labels are calculated from this moment.</span>
                </label>
                <label className="field">
                    <span className="field-label">Details (optional)</span>
                    <textarea
                        className="text-input text-area"
                        rows={3}
                        value={values.notes}
                        onChange={(event) => setValues({ ...values, notes: event.target.value })}
                    />
                </label>
                {error ? (
                    <p className="form-error" role="alert">
                        {error}
                    </p>
                ) : null}
            </form>
        </Modal>
    );
}
