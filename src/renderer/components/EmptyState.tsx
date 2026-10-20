import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
    icon: Icon,
    title,
    description,
    action,
    compact
}: {
    icon: LucideIcon;
    title: string;
    description?: string;
    action?: ReactNode;
    compact?: boolean;
}) {
    return (
        <div className={`empty-state${compact ? " is-compact" : ""}`}>
            <span className="empty-state-icon" aria-hidden="true">
                <Icon size={compact ? 16 : 20} strokeWidth={1.6} />
            </span>
            <p className="empty-state-title">{title}</p>
            {description ? <p className="empty-state-text">{description}</p> : null}
            {action ? <div className="empty-state-action">{action}</div> : null}
        </div>
    );
}
