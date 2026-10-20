import { X } from "lucide-react";
import { useI18n } from "@/i18n";

const TAG_TONES = ["purple", "peach", "mint", "sky", "sand", "rose"] as const;

export type TagTone = (typeof TAG_TONES)[number];

export function tagTone(tag: string): TagTone {
    if (/workshop/i.test(tag)) return "purple";
    if (/design challenge/i.test(tag)) return "peach";
    if (/progress/i.test(tag)) return "mint";
    if (/question/i.test(tag)) return "sky";
    if (/needs to be done/i.test(tag)) return "sand";
    let hash = 0;
    for (const char of tag) hash = (hash * 31 + char.charCodeAt(0)) % 997;
    return TAG_TONES[hash % TAG_TONES.length];
}

export function TagChip({
    tag,
    onSelect,
    onRemove
}: {
    tag: string;
    onSelect?: (tag: string) => void;
    onRemove?: () => void;
}) {
    const { t } = useI18n();
    const className = `tag-chip tag-${tagTone(tag)}`;

    if (onRemove) {
        return (
            <span className={`${className} tag-editable`}>
                {tag}
                <button type="button" className="tag-remove" aria-label={t("note.removeTag", { tag })} onClick={onRemove}>
                    <X size={10} strokeWidth={2.4} />
                </button>
            </span>
        );
    }

    if (onSelect) {
        return (
            <button
                type="button"
                className={className}
                onClick={(event) => {
                    event.stopPropagation();
                    onSelect(tag);
                }}
            >
                {tag}
            </button>
        );
    }

    return <span className={className}>{tag}</span>;
}
