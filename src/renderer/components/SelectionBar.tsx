import { Trash2, X } from "lucide-react";
import { useI18n } from "@/i18n";

/**
 * Toolbar shown while a list is in select mode: how many items are picked,
 * select-all / clear, bulk delete, and the exit button.
 */
export function SelectionBar({
    count,
    total,
    allSelected,
    onToggleAll,
    onDelete,
    onExit
}: {
    count: number;
    total: number;
    allSelected: boolean;
    onToggleAll: () => void;
    onDelete: () => void;
    onExit: () => void;
}) {
    const { t } = useI18n();
    return (
        <div className="selection-bar" role="toolbar" aria-label={t("common.selectionToolbar")}>
            <span className="selection-bar-count" aria-live="polite">
                {t("common.selectedCount", { count })}
            </span>
            <button
                type="button"
                className="button button-ghost button-small"
                onClick={onToggleAll}
                disabled={total === 0}
            >
                {allSelected ? t("common.clearSelection") : t("common.selectAll")}
            </button>
            <button
                type="button"
                className="button button-danger-ghost button-small"
                onClick={onDelete}
                disabled={count === 0}
            >
                <Trash2 size={13} strokeWidth={1.9} aria-hidden="true" />
                {t("common.deleteSelected")}
            </button>
            <button
                type="button"
                className="button button-ghost button-small selection-bar-exit"
                aria-label={t("common.exitSelection")}
                title={t("common.exitSelection")}
                onClick={onExit}
            >
                <X size={14} strokeWidth={2} aria-hidden="true" />
            </button>
        </div>
    );
}
