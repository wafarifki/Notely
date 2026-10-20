import type { SettingsRecord } from "@/db/schema";
import { ACCENTS, isHexColor, mixHex } from "./palette";

export type ResolvedTheme = "light" | "dark";

export interface ResolvedAppearance {
    theme: ResolvedTheme;
    accent: string;
    accentStrong: string;
    accentSoft: string;
    canvasA: string;
    canvasB: string;
    canvasC: string;
}

export function systemPrefersDark(): boolean {
    return typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function prefersReducedMotion(): boolean {
    return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function resolveAppearance(settings: SettingsRecord): ResolvedAppearance {
    const theme: ResolvedTheme =
        settings.theme === "auto" ? (systemPrefersDark() ? "dark" : "light") : settings.theme;
    const preset = ACCENTS[settings.accent] ?? ACCENTS.purple;
    const customAccent = settings.customAccent && isHexColor(settings.customAccent) ? settings.customAccent : null;
    const customCanvas = settings.customCanvas && isHexColor(settings.customCanvas) ? settings.customCanvas : null;

    const accent = customAccent ?? preset.accent;
    const accentStrong = mixHex(accent, "#000000", 0.2);
    const accentSoft =
        theme === "dark" ? mixHex(accent, "#121018", 0.84) : mixHex(accent, "#ffffff", 0.92);

    const canvasA = customCanvas ?? (theme === "dark" ? preset.canvasADark : preset.canvasA);
    // ─── OLD CODE (kept for reference) ───
    // const canvasB = theme === "dark" ? preset.canvasBDark : preset.canvasB;
    // const canvasC = customCanvas ?? (theme === "dark" ? preset.canvasCDark : preset.canvasC);
    // ─── NEW: a custom backdrop used to replace only the corner stops while the
    // middle stop kept the preset hue, so most of the gradient stayed unchanged
    // and the choice looked ignored. All three stops now follow the custom
    // colour, with the middle one tinted so the backdrop keeps its depth. ───
    const canvasB =
        customCanvas !== null
            ? mixHex(customCanvas, theme === "dark" ? "#ffffff" : "#000000", theme === "dark" ? 0.06 : 0.05)
            : theme === "dark"
              ? preset.canvasBDark
              : preset.canvasB;
    const canvasC = customCanvas ?? (theme === "dark" ? preset.canvasCDark : preset.canvasC);

    return { theme, accent, accentStrong, accentSoft, canvasA, canvasB, canvasC };
}

export function applyAppearance(appearance: ResolvedAppearance): void {
    const root = document.documentElement;
    root.dataset.theme = appearance.theme;
    root.style.setProperty("--accent-user", appearance.accent);
    root.style.setProperty("--accent-user-strong", appearance.accentStrong);
    root.style.setProperty("--accent-user-soft", appearance.accentSoft);
    root.style.setProperty("--canvas-a", appearance.canvasA);
    root.style.setProperty("--canvas-b", appearance.canvasB);
    root.style.setProperty("--canvas-c", appearance.canvasC);
    root.style.setProperty("--accent-user-rgb", hexToRgbChannels(appearance.accent));
}

export function hexToRgbChannels(hex: string): string {
    const value = hex.replace("#", "");
    const [r, g, b] = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16));
    return `${r}, ${g}, ${b}`;
}
