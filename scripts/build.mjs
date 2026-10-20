import { build } from "vite";

await build({ configFile: "vite.config.ts" });
await build({
    configFile: "vite.config.ts",
    publicDir: false,
    build: {
        outDir: "dist-electron",
        emptyOutDir: true,
        minify: false,
        sourcemap: false,
        target: "node22",
        lib: {
            entry: {
                main: "src/main/main.ts",
                preload: "src/preload/preload.ts"
            },
            formats: ["cjs"]
        },
        rollupOptions: {
            external: ["electron", "node:path"]
        }
    }
});
console.log("Renderer and Electron main process built.");
