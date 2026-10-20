import { PRIMARY_COLORS, type ProjectColor } from "@/db/schema";
import { useI18n } from "@/i18n";
import type { TranslationKey } from "@/i18n/translations";

// ─── NEW: colour names are translated (COLOR_LABELS stays as the English fallback). ───
const COLOR_KEYS: Record<ProjectColor, TranslationKey> = {
    purple: "color.purple",
    green: "color.green",
    orange: "color.orange",
    yellow: "color.yellow",
    pink: "color.pink",
    cyan: "color.cyan"
};

export function ColorPicker({
    value,
    onChange,
    legend,
    id = "project-color"
}: {
    value: ProjectColor;
    onChange: (color: ProjectColor) => void;
    legend?: string;
    id?: string;
}) {
    const { t } = useI18n();
    return (
        <div className="color-picker">
            <div className="field-label" id={`${id}-label`}>
                {legend ?? t("projectDialog.colorLabel")}
            </div>
            <div className="color-picker-swatches" role="radiogroup" aria-labelledby={`${id}-label`}>
                {PRIMARY_COLORS.map((color) => (
                    <button
                        key={color}
                        type="button"
                        role="radio"
                        aria-checked={value === color}
                        aria-label={t(COLOR_KEYS[color])}
                        title={t(COLOR_KEYS[color])}
                        className={`color-swatch${value === color ? " is-selected" : ""}`}
                        onClick={() => onChange(color)}
                    >
                        <span className="project-dot" data-color={color} />
                    </button>
                ))}
            </div>
        </div>
    );
}
