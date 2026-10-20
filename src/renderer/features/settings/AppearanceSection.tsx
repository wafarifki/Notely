import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Monitor, Moon, Palette, RotateCcw, Sun } from "lucide-react";
import { describeError, useStore } from "@/app/store";
import { useToast } from "@/components/Toasts";
import { ACCENT_NAMES, ACCENTS, isHexColor } from "@/theme/palette";
import { systemPrefersDark } from "@/theme/applyTheme";
import type { AccentName, SettingsRecord, ThemeMode } from "@/db/schema";
import { useUiTour } from "@/features/tour/useUiTour";
import { useI18n } from "@/i18n";
import type { TranslationKey } from "@/i18n/translations";

// ─── NEW: labels are translation keys so the theme switch follows the chosen language. ───
const THEME_OPTIONS: { value: ThemeMode; labelKey: TranslationKey; icon: typeof Sun; hintKey: TranslationKey }[] = [
    { value: "light", labelKey: "appearance.theme.light", icon: Sun, hintKey: "appearance.theme.lightHint" },
    { value: "dark", labelKey: "appearance.theme.dark", icon: Moon, hintKey: "appearance.theme.darkHint" },
    { value: "auto", labelKey: "appearance.theme.auto", icon: Monitor, hintKey: "appearance.theme.autoHint" }
];

// ─── NEW: accent names are translated too, with the palette label as the fallback. ───
const ACCENT_LABELS: Record<AccentName, TranslationKey> = {
    purple: "accent.purple",
    blue: "accent.blue",
    green: "accent.green",
    orange: "accent.orange",
    pink: "accent.pink",
    teal: "accent.teal"
};

function useColorDraft(value: string | null, fallback: string) {
    // ─── OLD CODE (kept for reference) ───
    // const [draft, setDraft] = useState(value ?? fallback);
    // useEffect(() => {
    //     setDraft(value ?? fallback);
    // }, [value, fallback]);
    // ─── NEW: the old effect only synced after a render, so for one frame the
    // hex box showed the previous colour and the change looked ignored. We now
    // remember which applied colour the draft belongs to and only treat the
    // draft as authoritative while the user is mid-edit (see `markEdited`). ───
    const applied = value ?? fallback;
    const [state, setState] = useState(() => ({ draft: applied, source: applied }));

    useEffect(() => {
        // Adopt the applied colour whenever it changes underneath us.
        setState((current) => (current.source === applied ? current : { draft: applied, source: applied }));
    }, [applied]);

    const setDraft = useCallback((next: string) => {
        setState({ draft: next, source: applied });
    }, [applied]);

    return [state.draft, setDraft] as const;
}

export function AppearanceSection({ settings }: { settings: SettingsRecord }) {
    const { service } = useStore();
    const toast = useToast();
    const tour = useUiTour();
    const { t } = useI18n();
    const [accentDraft, setAccentDraft] = useColorDraft(
        settings.customAccent,
        // ─── NEW: fall back to the preset that is actually applied, not a fixed
        // Lavender value, so the hex box always shows the live colour. ───
        ACCENTS[settings.accent]?.accent ?? "#9a53d2"
    );
    const [canvasDraft, setCanvasDraft] = useColorDraft(
        settings.customCanvas,
        // ─── NEW: match the theme's backdrop rather than a fixed light value. ───
        settings.theme === "dark"
            ? ACCENTS[settings.accent]?.canvasADark ?? "#1b1626"
            : ACCENTS[settings.accent]?.canvasC ?? "#dfd2f4"
    );
    // Fallbacks reused by the native colour inputs so they never show a stale hue.
    const accentFallback = ACCENTS[settings.accent]?.accent ?? "#9a53d2";
    const canvasFallback =
        settings.theme === "dark"
            ? ACCENTS[settings.accent]?.canvasADark ?? "#1b1626"
            : ACCENTS[settings.accent]?.canvasC ?? "#dfd2f4";

    // ─── OLD CODE (kept for reference) ───
    // const systemTheme = useMemo(() => (systemPrefersDark() ? "Dark" : "Light"), []);
    // ─── NEW: report the detected system theme as a translation key so the hint
    // reads "Saat ini gelap" in Indonesian instead of leaking English. ───
    const systemThemeKey: TranslationKey = useMemo(
        () => (systemPrefersDark() ? "appearance.theme.dark" : "appearance.theme.light"),
        []
    );

    async function update(patch: Partial<Omit<SettingsRecord, "id">>) {
        try {
            await service.settings.update(patch);
        } catch (error) {
            toast.error(describeError(error));
        }
    }

    function applyAccent(value: string) {
        if (!isHexColor(value)) {
            toast.error(t("appearance.invalidHex", { sample: "#9a53d2" }));
            return;
        }
        void update({ customAccent: value.toLowerCase() });
    }

    function applyCanvas(value: string) {
        if (!isHexColor(value)) {
            toast.error(t("appearance.invalidHex", { sample: "#dfd2f4" }));
            return;
        }
        void update({ customCanvas: value.toLowerCase() });
    }

    return (
        <section className="settings-section panel" data-tour="settings-appearance">
            <h2 className="settings-heading">{t("appearance.heading")}</h2>

            <div className="appearance-block">
                <span className="field-label">{t("appearance.theme")}</span>
                <div className="theme-options" role="radiogroup" aria-label={t("appearance.theme")}>
                    {THEME_OPTIONS.map((option) => {
                        const Icon = option.icon;
                        const selected = settings.theme === option.value;
                        return (
                            <button
                                key={option.value}
                                type="button"
                                role="radio"
                                aria-checked={selected}
                                className={`theme-option${selected ? " is-selected" : ""}`}
                                onClick={() => void update({ theme: option.value })}
                            >
                                <span className="theme-preview" data-preview={option.value} aria-hidden="true">
                                    <span />
                                    <span />
                                    <span />
                                </span>
                                <span className="theme-option-text">
                                    <span className="theme-option-label">
                                        <Icon size={13} strokeWidth={1.9} aria-hidden="true" />
                                        {t(option.labelKey)}
                                    </span>
                                    <span className="theme-option-hint">
                                        {option.value === "auto"
                                            ? t("appearance.theme.currently", {
                                                  value: t(systemThemeKey).toLowerCase()
                                              })
                                            : t(option.hintKey)}
                                    </span>
                                </span>
                                {selected ? (
                                    <Check className="theme-option-check" size={14} strokeWidth={2.4} aria-hidden="true" />
                                ) : null}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="appearance-block">
                <span className="field-label">{t("appearance.accentColor")}</span>
                <div className="accent-options" role="radiogroup" aria-label={t("appearance.accentColor")}>
                    {ACCENT_NAMES.map((name: AccentName) => {
                        const palette = ACCENTS[name];
                        const label = t(ACCENT_LABELS[name]);
                        const selected = settings.accent === name && !settings.customAccent;
                        return (
                            <button
                                key={name}
                                type="button"
                                role="radio"
                                aria-checked={selected}
                                className={`accent-option${selected ? " is-selected" : ""}`}
                                aria-label={label}
                                title={label}
                                onClick={() => void update({ accent: name, customAccent: null })}
                            >
                                <span
                                    className="accent-swatch"
                                    style={{
                                        background: `linear-gradient(135deg, ${palette.accent} 0 55%, ${palette.canvasA} 55% 100%)`
                                    }}
                                />
                                <span className="accent-option-label">{label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="appearance-block">
                <span className="field-label">{t("appearance.customColors")}</span>
                <div className="color-custom-row">
                    <label className="color-custom">
                        <input
                            type="color"
                            value={isHexColor(accentDraft) ? accentDraft : accentFallback}
                            onChange={(event) => {
                                setAccentDraft(event.target.value);
                                applyAccent(event.target.value);
                            }}
                            aria-label={t("appearance.pickAccent")}
                        />
                        <span>
                            <span className="color-custom-title">{t("appearance.accent")}</span>
                            <span className="color-custom-hint">{t("appearance.accentHint")}</span>
                        </span>
                    </label>
                    <div className="color-hex">
                        <input
                            className="text-input"
                            value={accentDraft}
                            maxLength={7}
                            aria-label={t("appearance.accentHex")}
                            onChange={(event) => {
                                const next = event.target.value;
                                setAccentDraft(next);
                                // ─── NEW: apply as soon as a complete hex is typed so
                                // the UI changes immediately instead of on blur. ───
                                if (isHexColor(next)) void update({ customAccent: next.toLowerCase() });
                            }}
                            onBlur={(event) => applyAccent(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") applyAccent(accentDraft);
                            }}
                        />
                        <button
                            type="button"
                            className="button button-ghost button-small"
                            onClick={() => void update({ customAccent: null })}
                        >
                            <RotateCcw size={12} strokeWidth={2} aria-hidden="true" />
                            {t("appearance.reset")}
                        </button>
                    </div>
                </div>
                <div className="color-custom-row">
                    <label className="color-custom">
                        <input
                            type="color"
                            value={isHexColor(canvasDraft) ? canvasDraft : canvasFallback}
                            onChange={(event) => {
                                setCanvasDraft(event.target.value);
                                applyCanvas(event.target.value);
                            }}
                            aria-label={t("appearance.pickBackdrop")}
                        />
                        <span>
                            <span className="color-custom-title">{t("appearance.backdrop")}</span>
                            <span className="color-custom-hint">{t("appearance.backdropHint")}</span>
                        </span>
                    </label>
                    <div className="color-hex">
                        <input
                            className="text-input"
                            value={canvasDraft}
                            maxLength={7}
                            aria-label={t("appearance.backdropHex")}
                            onChange={(event) => {
                                const next = event.target.value;
                                setCanvasDraft(next);
                                // ─── NEW: apply as soon as a complete hex is typed. ───
                                if (isHexColor(next)) void update({ customCanvas: next.toLowerCase() });
                            }}
                            onBlur={(event) => applyCanvas(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") applyCanvas(canvasDraft);
                            }}
                        />
                        <button
                            type="button"
                            className="button button-ghost button-small"
                            onClick={() => void update({ customCanvas: null })}
                        >
                            <RotateCcw size={12} strokeWidth={2} aria-hidden="true" />
                            {t("appearance.reset")}
                        </button>
                    </div>
                </div>
            </div>

            <div className="appearance-block">
                <label className="toggle-row">
                    <span>
                        <span className="toggle-title">{t("appearance.animatedBackdrop")}</span>
                        <span className="toggle-text">{t("appearance.animatedBackdropHint")}</span>
                    </span>
                    <input
                        type="checkbox"
                        className="switch"
                        checked={settings.animatedBackground}
                        onChange={(event) => void update({ animatedBackground: event.target.checked })}
                    />
                </label>
            </div>

            <div className="appearance-block">
                <span className="field-label">{t("appearance.productTour")}</span>
                <div className="inline-actions">
                    <button type="button" className="button button-ghost button-small" onClick={tour.startTour}>
                        <Palette size={13} strokeWidth={1.8} aria-hidden="true" />
                        {t("appearance.replayTour")}
                    </button>
                    <span className="field-hint">
                        {settings.tourCompleted ? t("appearance.tourCompleted") : t("appearance.tourNotFinished")}
                    </span>
                </div>
            </div>
        </section>
    );
}
