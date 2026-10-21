import { Clock3 } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { EmptyState } from "@/components/EmptyState";
import { SectionHeader } from "@/components/SectionHeader";
import { useStore } from "@/app/store";
import type { ActivityRecord } from "@/db/schema";
import { formatFullDate } from "@/lib/dates";
import { useI18n } from "@/i18n";
import type { TranslationKey } from "@/i18n/translations";

// ─── NEW: activity sentences are built from translation keys so they read
// naturally in both languages instead of being hardcoded English verbs. ───
export function activityDescription(
    activity: ActivityRecord,
    t: (key: TranslationKey, values?: Record<string, string | number>) => string
): string {
    const title = { title: activity.title, type: activity.entityType };
    // ─── NEW: the noun itself is translated too, so the sentence reads
    // "membuat proyek “X”" instead of mixing languages. ───
    const typeLabel = t(
        activity.entityType === "project"
            ? "activity.typeProject"
            : activity.entityType === "task"
              ? "activity.typeTask"
              : "activity.typeNote"
    );
    const created = { title: activity.title, type: typeLabel };
    switch (activity.kind) {
        case "created":
            return t("activity.created", created);
        case "updated":
            return activity.entityType === "project"
                ? t("activity.updatedProject", title)
                : activity.entityType === "task"
                  ? t("activity.updatedTask", title)
                  : t("activity.updatedNote", title);
        case "completed":
            return t("activity.completed", title);
        case "reopened":
            return t("activity.reopened", title);
        case "moved":
            return t("activity.moved", title);
        case "archived":
            return t("activity.archived", title);
        case "deleted":
            return t("activity.deleted", created);
        case "favorited":
            return t("activity.favorited", title);
        case "pinned":
            return t("activity.pinned", title);
        default:
            return activity.title;
    }
}

export function ActivityRow({
    activity,
    onOpen
}: {
    activity: ActivityRecord;
    onOpen?: (activity: ActivityRecord) => void;
}) {
    const { t, language } = useI18n();
    const { settings } = useStore();
    const clickable = Boolean(onOpen && activity.entityId);
    const description = activityDescription(activity, t);

    // ─── NEW: resolve the actor against the current profile. ───
    // `activity.actorName` / `actorImage` are a snapshot taken when the row was
    // written, so changing the display name or photo in Settings left every
    // existing history entry showing the old identity. Notely is a single-user
    // local app — every activity row was written by the profile that owns this
    // workspace — so the live settings are the correct source for the actor.
    //
    // ─── OLD CODE (kept for reference) ───
    // const actor = activity.actorId === settings.avatarId ? {...} : {...};
    // Matching on `avatarId` broke as soon as the user picked a different
    // preset avatar, because old rows kept the previous id.
    const actorName = settings.displayName || activity.actorName;
    const actorImage = settings.avatarImage ?? null;

    return (
        <li className="activity-row">
            <button
                type="button"
                className="activity-row-button"
                onClick={() => clickable && onOpen?.(activity)}
                disabled={!clickable}
                title={clickable ? t("activity.openRelated") : t("activity.relatedGone")}
            >
                <Avatar
                    id={settings.avatarId || activity.actorId}
                    name={actorName}
                    size={34}
                    image={actorImage}
                />
                <span className="activity-row-text">
                    <span className="activity-actor">{actorName}</span>
                    <span className="activity-detail" title={description}>
                        {description}
                    </span>
                </span>
                <span className="activity-date">{formatFullDate(activity.createdAt, language)}</span>
            </button>
        </li>
    );
}

export function ActivityPanel({
    activity,
    onOpen,
    limit = 5,
    className = ""
}: {
    activity: ActivityRecord[];
    onOpen?: (activity: ActivityRecord) => void;
    limit?: number;
    className?: string;
}) {
    const { t } = useI18n();
    const visible = activity.slice(0, limit);
    return (
        <section className={`dashboard-section activity-section ${className}`.trim()}>
            <SectionHeader icon={Clock3} title={t("activity.recent")} />
            <div className="panel activity-panel">
                {visible.length === 0 ? (
                    <EmptyState
                        icon={Clock3}
                        title={t("activity.emptyTitle")}
                        description={t("activity.emptyText")}
                        compact
                    />
                ) : (
                    <ul className="activity-list">
                        {visible.map((row) => (
                            <ActivityRow key={row.id} activity={row} onOpen={onOpen} />
                        ))}
                    </ul>
                )}
            </div>
        </section>
    );
}
