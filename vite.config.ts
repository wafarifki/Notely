import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

const projectRoot = __dirname;

export default defineConfig({
    base: "./",
    plugins: [react()],
    resolve: {
        alias: {
            "@": resolve(projectRoot, "src/renderer")
        }
    },
    server: {
        port: 5391,
        strictPort: true
    },
    build: {
        outDir: "dist",
        emptyOutDir: true,
        target: "chrome128",
        assetsInlineLimit: 4096
    },
    test: {
        environment: "jsdom",
        globals: true,
        setupFiles: ["./tests/setup.ts"],
        include: ["tests/**/*.test.{ts,tsx}"],
        restoreMocks: true
    }
});
