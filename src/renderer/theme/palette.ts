import type { AccentName } from "@/db/schema";

export interface AccentPalette {
    label: string;
    accent: string;
    accentStrong: string;
    accentSoft: string;
    accentSoftDark: string;
    canvasA: string;
    canvasB: string;
    canvasC: string;
    canvasADark: string;
    canvasBDark: string;
    canvasCDark: string;
}

export const ACCENTS: Record<AccentName, AccentPalette> = {
    purple: {
        label: "Lavender",
        accent: "#9a53d2",
        accentStrong: "#7d3fb1",
        accentSoft: "#f3eafb",
        accentSoftDark: "#2c2039",
        canvasA: "#f1d9e1",
        canvasB: "#cddaed",
        canvasC: "#dfd2f4",
        canvasADark: "#241a33",
        canvasBDark: "#141d2c",
        canvasCDark: "#1b1626"
    },
    blue: {
        label: "Ocean",
        accent: "#3f7fd6",
        accentStrong: "#2f66b3",
        accentSoft: "#e8f0fc",
        accentSoftDark: "#1b2638",
        canvasA: "#d9e8f6",
        canvasB: "#cfe0f5",
        canvasC: "#dcdcf3",
        canvasADark: "#131f30",
        canvasBDark: "#121b2a",
        canvasCDark: "#171826"
    },
    green: {
        label: "Mint",
        accent: "#1f9d76",
        accentStrong: "#187a5c",
        accentSoft: "#e4f5ee",
        accentSoftDark: "#152a25",
        canvasA: "#dceee2",
        canvasB: "#d3e9ec",
        canvasC: "#dfe2f2",
        canvasADark: "#142420",
        canvasBDark: "#122423",
        canvasCDark: "#171a26"
    },
    orange: {
        label: "Sunset",
        accent: "#e07a3f",
        accentStrong: "#b95f2c",
        accentSoft: "#fcefe6",
        accentSoftDark: "#2e2119",
        canvasA: "#f6ddcf",
        canvasB: "#e9dcec",
        canvasC: "#dcd3ef",
        canvasADark: "#2a1e1a",
        canvasBDark: "#221a29",
        canvasCDark: "#1c1826"
    },
    pink: {
        label: "Rose",
        accent: "#d9549b",
        accentStrong: "#b13d7d",
        accentSoft: "#fce8f2",
        accentSoftDark: "#2e1b28",
        canvasA: "#f6d6e4",
        canvasB: "#e3d9f1",
        canvasC: "#d9d3ef",
        canvasADark: "#2a1926",
        canvasBDark: "#211a2d",
        canvasCDark: "#1b1727"
    },
    teal: {
        label: "Teal",
        accent: "#2aa8b8",
        accentStrong: "#1f8794",
        accentSoft: "#e3f6f8",
        accentSoftDark: "#13292d",
        canvasA: "#d5eef0",
        canvasB: "#d2e4f2",
        canvasC: "#dcd7f0",
        canvasADark: "#122527",
        canvasBDark: "#131f2b",
        canvasCDark: "#191a27"
    }
};

export const ACCENT_NAMES = Object.keys(ACCENTS) as AccentName[];

export function mixHex(a: string, b: string, ratio: number): string {
    const parse = (value: string) => {
        const hex = value.replace("#", "");
        const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
        return [0, 2, 4].map((offset) => parseInt(full.slice(offset, offset + 2), 16));
    };
    const [r1, g1, b1] = parse(a);
    const [r2, g2, b2] = parse(b);
    const channel = (x: number, y: number) => Math.round(x + (y - x) * ratio).toString(16).padStart(2, "0");
    return `#${channel(r1, r2)}${channel(g1, g2)}${channel(b1, b2)}`;
}

export function isHexColor(value: string): boolean {
    return /^#[0-9a-fA-F]{6}$/.test(value.trim());
}

export function contrastText(hex: string): string {
    const value = hex.replace("#", "");
    const [r, g, b] = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255);
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return luminance > 0.62 ? "#1b1530" : "#ffffff";
}
