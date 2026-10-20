import { COLOR_LABELS, PRIMARY_COLORS, type ProjectColor } from "@/db/schema";

export function ColorPicker({
    value,
    onChange,
    legend = "Project color",
    id = "project-color"
}: {
    value: ProjectColor;
    onChange: (color: ProjectColor) => void;
    legend?: string;
    id?: string;
}) {
    return (
        <div className="color-picker">
            <div className="field-label" id={`${id}-label`}>
                {legend}
            </div>
            <div className="color-picker-swatches" role="radiogroup" aria-labelledby={`${id}-label`}>
                {PRIMARY_COLORS.map((color) => (
                    <button
                        key={color}
                        type="button"
                        role="radio"
                        aria-checked={value === color}
                        aria-label={COLOR_LABELS[color]}
                        title={COLOR_LABELS[color]}
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
