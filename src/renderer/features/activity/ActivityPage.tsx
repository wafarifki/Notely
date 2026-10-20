import { useMemo, useState } from "react";
import { ArrowLeft, Clock3, Trash2 } from "lucide-react";
import { describeError, useStore } from "@/app/store";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { useToast } from "@/components/Toasts";
import { relativeDayLabel } from "@/lib/dates";
import { useWorkflows } from "@/feature-hooks";
import { useI18n } from "@/i18n";
import { ActivityRow } from "./ActivityPanel";

// ─── OLD CODE (kept for reference) ───
// export function ActivityPage() {
//     const { activity, ready } = useStore();
//     const workflows = useWorkflows();
//     const { t, language } = useI18n();
//     const [limit, setLimit] = useState(25);
//     …
//     const groups = new Map<string, typeof activity>();
//     activity.slice(0, limit).forEach((row) => { … });
//     …
//     {activity.length > limit ? (<button className="… load-more" …>{t("common.showMore")}</button>) : null}
//     …
// }
// ─── NEW: the page shows the whole stored history (the store keeps the newest
// 60 rows) instead of paging through it, and it offers a "Clear activity"
// action with a confirmation step so the log can be wiped without touching
// projects, notes or tasks. ───
export function ActivityPage() {
    const { activity, ready, service } = useStore();
    const workflows = useWorkflows();
    const toast = useToast();
    const { t, language } = useI18n();
    const [confirming, setConfirming] = useState(false);
    const [clearing, setClearing] = useState(false);

    // ─── NEW: group by relative day once per data change, not per render. ───
    const groups = useMemo(() => {
        const map = new Map<string, typeof activity>();
        activity.forEach((row) => {
            const label = relativeDayLabel(row.createdAt, new Date(), t, language);
            const list = map.get(label) ?? [];
            list.push(row);
            map.set(label, list);
        });
        return [...map.entries()];
    }, [activity, t, language]);

    async function clearActivity() {
        setClearing(true);
        try {
            await service.clearActivity();
            toast.success(t("activity.cleared"));
            setConfirming(false);
        } catch (error) {
            toast.error(describeError(error));
        } finally {
            setClearing(false);
        }
    }

    if (!ready) {
        return <div className="page-loading" aria-busy="true" />;
    }

    return (
        <div className="page activity-page">
            <div className="page-topbar">
                <button type="button" className="back-link" onClick={() => workflows.go({ name: "home" })}>
                    <ArrowLeft size={14} strokeWidth={1.9} aria-hidden="true" />
                    {t("nav.home")}
                </button>
                {activity.length > 0 ? (
                    <div className="page-topbar-actions">
                        <button
                            type="button"
                            className="button button-danger-ghost button-small"
                            onClick={() => setConfirming(true)}
                        >
                            <Trash2 size={13} strokeWidth={1.8} aria-hidden="true" />
                            {t("activity.clear")}
                        </button>
                    </div>
                ) : null}
            </div>
            <header className="page-header">
                <div>
                    <h1 className="page-title">{t("activity.recent")}</h1>
                    <p className="page-subtitle">{t("activity.subtitle")}</p>
                </div>
            </header>
            {activity.length === 0 ? (
                <div className="panel">
                    <EmptyState
                        icon={Clock3}
                        title={t("activity.emptyTitle")}
                        description={t("activity.emptyTextPage")}
                    />
                </div>
            ) : (
                <div className="activity-groups">
                    {groups.map(([label, rows]) => (
                        <section key={label} className="activity-group">
                            <h2 className="activity-group-label">{label}</h2>
                            <ul className="panel activity-list activity-list-page">
                                {rows.map((row) => (
                                    <ActivityRow
                                        key={row.id}
                                        activity={row}
                                        onOpen={(entry) => workflows.openActivityTarget(entry.entityType, entry.entityId)}
                                    />
                                ))}
                            </ul>
                        </section>
                    ))}
                </div>
            )}

            <ConfirmDialog
                open={confirming}
                title={t("activity.clearTitle")}
                confirmLabel={t("activity.clearConfirm")}
                tone="danger"
                busy={clearing}
                onCancel={() => setConfirming(false)}
                onConfirm={() => void clearActivity()}
            >
                <p>{t("activity.clearBody")}</p>
            </ConfirmDialog>
        </div>
    );
}
