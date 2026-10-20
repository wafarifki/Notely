import { useEffect, useId, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { Modal } from "@/components/Modal";
import type { TaskInput, TaskPriority } from "@/db/taskRepository";
import type { ProjectRecord, TaskChecklistItem, TaskRecord } from "@/db/schema";
import { fromDateTimeInputValue, toDateTimeInputValue } from "@/lib/dates";
import { useI18n } from "@/i18n";
import type { TranslationKey } from "@/i18n/translations";

// ─── NEW: priority labels are translation keys. ───
const PRIORITY_OPTIONS: { value: TaskPriority; labelKey: TranslationKey }[] = [
    { value: "low", labelKey: "task.priorityLow" },
    { value: "medium", labelKey: "task.priorityMedium" },
    { value: "high", labelKey: "task.priorityHigh" }
];

interface TaskFormValues {
    title: string;
    notes: string;
    projectId: string;
    priority: TaskPriority;
    due: string;
    // ─── NEW: optional sub-steps, edited inline below the details field. ───
    checklist: TaskChecklistItem[];
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
    const { t } = useI18n();
    const [values, setValues] = useState<TaskFormValues>({
        title: "",
        notes: "",
        projectId: "",
        priority: "medium",
        due: "",
        checklist: []
    });
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    // New rows are appended with a stable temporary id until they get text.
    const nextChecklistId = useRef(0);

    useEffect(() => {
        if (!open) return;
        setValues({
            title: task?.title ?? "",
            notes: task?.notes ?? "",
            projectId: task?.projectId ?? defaultProjectId ?? "",
            priority: task?.priority ?? "medium",
            due: toDateTimeInputValue(task?.dueAt ?? null),
            checklist: task?.checklist ?? []
        });
        setError(null);
        setBusy(false);
        nextChecklistId.current = 0;
    }, [open, task, defaultProjectId]);

    function addChecklistItem() {
        nextChecklistId.current += 1;
        setValues((current) => ({
            ...current,
            checklist: [
                ...current.checklist,
                { id: `draft-${nextChecklistId.current}`, text: "", done: false }
            ]
        }));
    }

    function updateChecklistItem(id: string, patch: Partial<TaskChecklistItem>) {
        setValues((current) => ({
            ...current,
            checklist: current.checklist.map((item) => (item.id === id ? { ...item, ...patch } : item))
        }));
    }

    function removeChecklistItem(id: string) {
        setValues((current) => ({
            ...current,
            checklist: current.checklist.filter((item) => item.id !== id)
        }));
    }

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        if (busy) return;
        if (!values.title.trim()) {
            setError(t("task.titleRequired"));
            return;
        }
        setBusy(true);
        try {
            await onSubmit({
                title: values.title,
                notes: values.notes,
                projectId: values.projectId || null,
                priority: values.priority,
                dueAt: fromDateTimeInputValue(values.due),
                // ─── NEW: blank rows are dropped by the repository. ───
                checklist: values.checklist.map((item) => ({
                    id: item.id.startsWith("draft-") ? undefined : item.id,
                    text: item.text,
                    done: item.done
                }))
            });
        } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : t("task.saveFailed"));
            setBusy(false);
        }
    }

    const activeProjects = projects.filter((project) => !project.archived || project.id === task?.projectId);

    return (
        <Modal
            open={open}
            size="small"
            title={task ? t("task.editTitle") : t("task.newTitle")}
            onClose={onClose}
            footer={
                <>
                    {task && onDelete ? (
                        <button type="button" className="button button-danger-ghost" onClick={onDelete}>
                            {t("common.delete")}
                        </button>
                    ) : null}
                    <span className="modal-footer-spacer" />
                    <button type="button" className="button button-ghost" onClick={onClose}>
                        {t("common.cancel")}
                    </button>
                    <button type="submit" form={formId} className="button button-primary" data-primary disabled={busy}>
                        {task ? t("task.saveChanges") : t("task.add")}
                    </button>
                </>
            }
        >
            <form id={formId} className="form-stack" onSubmit={handleSubmit} noValidate>
                <label className="field">
                    <span className="field-label">{t("task.titleLabel")}</span>
                    <input
                        className="text-input"
                        value={values.title}
                        maxLength={160}
                        autoFocus
                        placeholder={t("task.titlePlaceholder")}
                        onChange={(event) => setValues({ ...values, title: event.target.value })}
                        aria-invalid={Boolean(error) && !values.title.trim()}
                    />
                </label>
                <div className="field-row">
                    <label className="field">
                        <span className="field-label">{t("task.projectLabel")}</span>
                        <select
                            className="text-input select-input"
                            value={values.projectId}
                            onChange={(event) => setValues({ ...values, projectId: event.target.value })}
                        >
                            <option value="">{t("common.unassigned")}</option>
                            {activeProjects.map((project) => (
                                <option key={project.id} value={project.id}>
                                    {project.name}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="field">
                        <span className="field-label">{t("task.priorityLabel")}</span>
                        <select
                            className="text-input select-input"
                            value={values.priority}
                            onChange={(event) =>
                                setValues({ ...values, priority: event.target.value as TaskPriority })
                            }
                        >
                            {PRIORITY_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {t(option.labelKey)}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
                <label className="field">
                    <span className="field-label">{t("task.dueLabel")}</span>
                    <input
                        type="datetime-local"
                        className="text-input"
                        value={values.due}
                        onChange={(event) => setValues({ ...values, due: event.target.value })}
                    />
                    <span className="field-hint">{t("task.dueHint")}</span>
                </label>
                <label className="field">
                    <span className="field-label">{t("task.detailsLabel")}</span>
                    <textarea
                        className="text-input text-area"
                        rows={3}
                        value={values.notes}
                        onChange={(event) => setValues({ ...values, notes: event.target.value })}
                    />
                </label>
                {/* ─── NEW: optional checklist. Add, tick, edit and remove rows. ─── */}
                <div className="field checklist-field">
                    <span className="field-label">{t("task.checklistLabel")}</span>
                    {values.checklist.length === 0 ? (
                        <span className="field-hint">{t("task.checklistEmpty")}</span>
                    ) : (
                        <ul className="checklist-editor">
                            {values.checklist.map((item) => (
                                <li key={item.id} className={`checklist-row${item.done ? " is-done" : ""}`}>
                                    <input
                                        type="checkbox"
                                        className="checklist-box"
                                        checked={item.done}
                                        aria-label={t("task.checklistToggle", { text: item.text || t("task.checklistUntitled") })}
                                        onChange={(event) =>
                                            updateChecklistItem(item.id, { done: event.target.checked })
                                        }
                                    />
                                    <input
                                        type="text"
                                        className="text-input checklist-text"
                                        value={item.text}
                                        maxLength={200}
                                        placeholder={t("task.checklistPlaceholder")}
                                        aria-label={t("task.checklistItemLabel")}
                                        onChange={(event) =>
                                            updateChecklistItem(item.id, { text: event.target.value })
                                        }
                                        onKeyDown={(event) => {
                                            // Enter adds the next row, matching common checklist editors.
                                            if (event.key === "Enter") {
                                                event.preventDefault();
                                                addChecklistItem();
                                            }
                                        }}
                                    />
                                    <button
                                        type="button"
                                        className="icon-button checklist-remove"
                                        aria-label={t("task.checklistRemove")}
                                        title={t("task.checklistRemove")}
                                        onClick={() => removeChecklistItem(item.id)}
                                    >
                                        <X size={13} strokeWidth={2} />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                    <button
                        type="button"
                        className="button button-ghost button-small checklist-add"
                        onClick={addChecklistItem}
                    >
                        <Plus size={13} strokeWidth={2} aria-hidden="true" />
                        {t("task.checklistAdd")}
                    </button>
                </div>
                {error ? (
                    <p className="form-error" role="alert">
                        {error}
                    </p>
                ) : null}
            </form>
        </Modal>
    );
}
