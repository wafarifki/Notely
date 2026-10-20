import { Clock3 } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { EmptyState } from "@/components/EmptyState";
import { SectionHeader } from "@/components/SectionHeader";
import type { ActivityRecord } from "@/db/schema";
import { formatFullDate } from "@/lib/dates";

export function activityDescription(activity: ActivityRecord): string {
    switch (activity.kind) {
        case "created":
            return `created ${activity.entityType} “${activity.title}”`;
        case "updated":
            return activity.entityType === "project"
                ? `updated project “${activity.title}”`
                : activity.entityType === "task"
                  ? `edited task “${activity.title}”`
                  : activity.title;
        case "completed":
            return `completed “${activity.title}”`;
        case "reopened":
            return `reopened “${activity.title}”`;
        case "moved":
            return `moved “${activity.title}”`;
        case "archived":
            return `archived “${activity.title}”`;
        case "deleted":
            return `deleted “${activity.title}”`;
        case "favorited":
            return `starred “${activity.title}”`;
        case "pinned":
            return `pinned “${activity.title}”`;
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
    const clickable = Boolean(onOpen && activity.entityId);
    return (
        <li className="activity-row">
            <button
                type="button"
                className="activity-row-button"
                onClick={() => clickable && onOpen?.(activity)}
                disabled={!clickable}
                title={clickable ? "Open related item" : "Related item no longer exists"}
            >
                <Avatar id={activity.actorId} name={activity.actorName} size={34} />
                <span className="activity-row-text">
                    <span className="activity-actor">{activity.actorName}</span>
                    <span className="activity-detail" title={activityDescription(activity)}>
                        {activityDescription(activity)}
                    </span>
                </span>
                <span className="activity-date">{formatFullDate(activity.createdAt)}</span>
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
    const visible = activity.slice(0, limit);
    return (
        <section className={`dashboard-section activity-section ${className}`.trim()}>
            <SectionHeader icon={Clock3} title="Recent activity" />
            <div className="panel activity-panel">
                {visible.length === 0 ? (
                    <EmptyState
                        icon={Clock3}
                        title="No activity yet"
                        description="Changes you make to notes, tasks and projects will show up here."
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
