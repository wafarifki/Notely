import { useEffect, useId, useState } from "react";
import { ColorPicker } from "./ColorPicker";
import { Modal } from "./Modal";
import type { ProjectColor, ProjectRecord } from "@/db/schema";
import { useI18n } from "@/i18n";

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
    const { t } = useI18n();
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
            setError(t("projectDialog.nameRequired"));
            return;
        }
        setBusy(true);
        try {
            await onSubmit(values);
        } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : t("projectDialog.saveFailed"));
            setBusy(false);
        }
    }

    return (
        <Modal
            open={open}
            size="small"
            title={editing ? t("projectDialog.editTitle") : t("projectDialog.newTitle")}
            description={
                editing ? t("projectDialog.editDescription") : t("projectDialog.newDescription")
            }
            onClose={onClose}
            footer={
                <>
                    <button type="button" className="button button-ghost" onClick={onClose}>
                        {t("common.cancel")}
                    </button>
                    <button
                        type="submit"
                        form={formId}
                        className="button button-primary"
                        data-primary
                        disabled={busy}
                    >
                        {editing ? t("projectDialog.saveChanges") : t("projectDialog.create")}
                    </button>
                </>
            }
        >
            <form id={formId} className="form-stack" onSubmit={handleSubmit} noValidate>
                <label className="field">
                    <span className="field-label">{t("projectDialog.nameLabel")}</span>
                    <input
                        className="text-input"
                        value={values.name}
                        maxLength={120}
                        autoFocus
                        placeholder={t("projectDialog.namePlaceholder")}
                        onChange={(event) => setValues({ ...values, name: event.target.value })}
                        aria-invalid={Boolean(error) && !values.name.trim()}
                    />
                </label>
                <label className="field">
                    <span className="field-label">{t("projectDialog.descriptionLabel")}</span>
                    <textarea
                        className="text-input text-area"
                        rows={3}
                        maxLength={600}
                        value={values.description}
                        placeholder={t("projectDialog.descriptionPlaceholder")}
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
