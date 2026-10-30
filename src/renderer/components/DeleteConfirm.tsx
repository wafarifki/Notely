import { ConfirmDialog } from "./ConfirmDialog";
import { useI18n } from "@/i18n";
import type { TranslationKey } from "@/i18n/translations";

export function DeleteConfirm({
    open,
    subject,
    detail,
    count = 1,
    onCancel,
    onConfirm
}: {
    open: boolean;
    subject: "note" | "task" | "project";
    detail?: string;
    // ─── NEW: when several items are selected at once the title and body switch
    // to their plural forms. ───
    count?: number;
    onCancel: () => void;
    onConfirm: () => void;
}) {
    const { t } = useI18n();
    // ─── NEW: the subject is a key now, so the sentence works in both languages. ───
    const subjectKey = `subject.${subject}` as TranslationKey;
    const subjectLabel = t(subjectKey);
    const bulk = count > 1;
    const pluralKey = `subject.${subject}Plural` as TranslationKey;
    const title = bulk
        ? t("delete.countTitle", { count, subject: t(pluralKey) })
        : t("delete.title", { subject: subjectLabel });
    const body = bulk
        ? t("delete.countBody", { count, subject: t(pluralKey) })
        : t("delete.body", { subject: subjectLabel });

    return (
        <ConfirmDialog
            open={open}
            title={title}
            confirmLabel={t("common.delete")}
            tone="danger"
            onCancel={onCancel}
            onConfirm={onConfirm}
        >
            <p>{body}</p>
            {detail ? <p className="confirm-muted">{detail}</p> : null}
        </ConfirmDialog>
    );
}
