import { ConfirmDialog } from "./ConfirmDialog";
import { useI18n } from "@/i18n";
import type { TranslationKey } from "@/i18n/translations";

export function DeleteConfirm({
    open,
    subject,
    detail,
    onCancel,
    onConfirm
}: {
    open: boolean;
    subject: "note" | "task" | "project";
    detail?: string;
    onCancel: () => void;
    onConfirm: () => void;
}) {
    const { t } = useI18n();
    // ─── NEW: the subject is a key now, so the sentence works in both languages. ───
    const subjectKey = `subject.${subject}` as TranslationKey;
    const subjectLabel = t(subjectKey);

    return (
        <ConfirmDialog
            open={open}
            title={t("delete.title", { subject: subjectLabel })}
            confirmLabel={t("common.delete")}
            tone="danger"
            onCancel={onCancel}
            onConfirm={onConfirm}
        >
            <p>{t("delete.body", { subject: subjectLabel })}</p>
            {detail ? <p className="confirm-muted">{detail}</p> : null}
        </ConfirmDialog>
    );
}
