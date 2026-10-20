import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function SectionHeader({
    icon: Icon,
    title,
    action
}: {
    icon: LucideIcon;
    title: string;
    action?: ReactNode;
}) {
    return (
        <div className="section-header">
            <span className="section-icon" aria-hidden="true">
                <Icon size={15} strokeWidth={1.6} />
            </span>
            <h2 className="section-title">{title}</h2>
            {action ? <div className="section-action">{action}</div> : null}
        </div>
    );
}
