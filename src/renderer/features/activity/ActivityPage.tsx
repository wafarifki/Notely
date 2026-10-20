import { useState } from "react";
import { Clock3 } from "lucide-react";
import { useStore } from "@/app/store";
import { EmptyState } from "@/components/EmptyState";
import { relativeDayLabel } from "@/lib/dates";
import { useWorkflows } from "@/feature-hooks";
import { ActivityRow } from "./ActivityPanel";

export function ActivityPage() {
    const { activity, ready } = useStore();
    const workflows = useWorkflows();
    const [limit, setLimit] = useState(25);

    if (!ready) {
        return <div className="page-loading" aria-busy="true" />;
    }

    const groups = new Map<string, typeof activity>();
    activity.slice(0, limit).forEach((row) => {
        const label = relativeDayLabel(row.createdAt);
        const list = groups.get(label) ?? [];
        list.push(row);
        groups.set(label, list);
    });

    return (
        <div className="page activity-page">
            <header className="page-header">
                <div>
                    <h1 className="page-title">Recent activity</h1>
                    <p className="page-subtitle">Every change made in this workspace, stored on this device.</p>
                </div>
            </header>
            {activity.length === 0 ? (
                <div className="panel">
                    <EmptyState
                        icon={Clock3}
                        title="No activity yet"
                        description="Create or edit a note, task or project and it will appear here."
                    />
                </div>
            ) : (
                <div className="activity-groups">
                    {[...groups.entries()].map(([label, rows]) => (
                        <section key={label} className="activity-group">
                            <h2 className="activity-group-label">{label}</h2>
                            <ul className="panel activity-list">
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
                    {activity.length > limit ? (
                        <button
                            type="button"
                            className="button button-ghost button-small load-more"
                            onClick={() => setLimit((value) => value + 25)}
                        >
                            Show more
                        </button>
                    ) : null}
                </div>
            )}
        </div>
    );
}
