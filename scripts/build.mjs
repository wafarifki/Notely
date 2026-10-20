import { rmSync } from "node:fs";
import { build } from "vite";

await build({ configFile: "vite.config.ts" });

// Clear dist-electron once, before the two Electron passes. The passes below
// cannot use `emptyOutDir` because the second one would delete the first one's
// output, and a stale `channels-*.js` left behind would look like a real chunk.
rmSync("dist-electron", { recursive: true, force: true });

// ─── OLD CODE (kept for reference) ───
// Both entries were built in a single pass:
//
// await build({
//     configFile: "vite.config.ts",
//     publicDir: false,
//     build: {
//         outDir: "dist-electron",
//         emptyOutDir: true,
//         minify: false,
//         sourcemap: false,
//         target: "node22",
//         lib: {
//             entry: {
//                 main: "src/main/main.ts",
//                 preload: "src/preload/preload.ts"
//             },
//             formats: ["cjs"]
//         },
//         rollupOptions: {
//             external: [/^electron(\/.*)?$/, /^node:/]
//         }
//     }
// });
//
// ─── NEW: main and preload are built SEPARATELY ───
// A sandboxed Electron preload CANNOT `require()` another local file — it runs
// in a restricted module loader that only resolves `electron`. Building both
// entries together let Rollup hoist the shared `channels.ts` module into a
// chunk (`channels-*.js`) and preload emitted `require("./channels-….js")`,
// which failed at runtime with:
//
//     Unable to load preload script: …\preload.js
//     Error: module not found: ./channels-RNu3sMky.js
//
// With no preload, `window.notesDesktop` never appears, so the renderer thinks
// it is running in a plain browser: no window controls, no `electron-runtime`
// class (which broke the full-height layout) and no file-open handling.
//
// `inlineDynamicImports` forces every module the preload needs into one
// self-contained file, so it never emits a `require("./chunk-….js")` that the
// sandboxed loader cannot resolve.
await build({
    configFile: "vite.config.ts",
    publicDir: false,
    build: {
        outDir: "dist-electron",
        emptyOutDir: false,
        minify: false,
        sourcemap: false,
        target: "node22",
        lib: {
            entry: { main: "src/main/main.ts" },
            formats: ["cjs"]
        },
        rollupOptions: {
            external: [/^electron(\/.*)?$/, /^node:/],
            output: {
                // Keep main.js self-contained as well: one file is easier to
                // reason about when debugging a packaged build.
                inlineDynamicImports: true
            }
        }
    }
});

await build({
    configFile: "vite.config.ts",
    publicDir: false,
    build: {
        outDir: "dist-electron",
        emptyOutDir: false,
        minify: false,
        sourcemap: false,
        target: "node22",
        lib: {
            entry: { preload: "src/preload/preload.ts" },
            formats: ["cjs"],
            // Everything the preload needs goes into this single file.
            fileName: () => "preload.js"
        },
        rollupOptions: {
            external: [/^electron(\/.*)?$/, /^node:/],
            output: {
                inlineDynamicImports: true
            }
        }
    }
});

console.log("Renderer, main process and preload built.");

// ─── OLD CODE (kept for reference) ───
// The installer helper used to be copied into `dist/installer/`. That placed it
// inside app.asar, where NSIS could not execute it, so the Explorer context-menu
// entries were never created. electron-builder.yml now uses `extraResources`,
// which copies it to a real `resources/installer/context-menu.ps1` next to the
// app instead.
//
// const installerTarget = join(root, "..", "dist", "installer");
// mkdirSync(installerTarget, { recursive: true });
// cpSync(join(root, "..", "build", "installer", "context-menu.ps1"), join(installerTarget, "context-menu.ps1"));
// console.log("Installer helper copied into dist/installer.");
