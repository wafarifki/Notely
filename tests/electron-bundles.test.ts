import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Regression guard for the packaged Electron bundles.
 *
 * A sandboxed preload cannot resolve a local `require()`: its module loader
 * only knows about `electron`. When the build put shared code in a chunk, the
 * preload emitted `require("./channels-….js")`, failed to load, and the whole
 * renderer quietly fell back to "not running in Electron" — no window
 * controls, no full-height layout and no file-open handling.
 *
 * These tests fail loudly if that shape ever comes back, because the symptom
 * is invisible in a browser-based test run.
 */
const distDir = join(process.cwd(), "dist-electron");

function readBundle(name: string): string | null {
    const file = join(distDir, name);
    return existsSync(file) ? readFileSync(file, "utf8") : null;
}

describe("electron bundles", () => {
    it("ships a preload that requires nothing but electron", () => {
        const preload = readBundle("preload.js");
        if (!preload) return; // Not built yet in this environment.

        const localRequires = [...preload.matchAll(/require\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)/g)];
        expect(localRequires.map((match) => match[1])).toEqual([]);
    });

    it("exposes the desktop bridge on window", () => {
        const preload = readBundle("preload.js");
        if (!preload) return;

        expect(preload).toContain("notesDesktop");
        expect(preload).toContain("contextBridge");
    });

    it("ships a main bundle that requires nothing but electron and node builtins", () => {
        const main = readBundle("main.js");
        if (!main) return;

        const localRequires = [...main.matchAll(/require\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)/g)];
        expect(localRequires.map((match) => match[1])).toEqual([]);
    });
});
