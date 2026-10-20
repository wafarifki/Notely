import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const electronBinary = require("electron");

function checkElectronBinary() {
    try {
        readFileSync(join(root, "node_modules", "electron", "path.txt"), "utf8");
        return true;
    } catch {
        console.error(
            "Electron binary is missing. Run `node node_modules/electron/install.js` once with network access."
        );
        return false;
    }
}

function run(command, args, env = {}) {
    return spawn(command, args, {
        cwd: root,
        stdio: "inherit",
        shell: process.platform === "win32",
        env: { ...process.env, ...env }
    });
}

async function waitForServer(url, timeoutMs = 60000) {
    const started = Date.now();
    for (;;) {
        try {
            const response = await fetch(url);
            if (response.ok) return;
        } catch {
            // vite is still starting
        }
        if (Date.now() - started > timeoutMs) {
            throw new Error(`Timed out waiting for ${url}`);
        }
        await new Promise((resolve) => setTimeout(resolve, 300));
    }
}

async function main() {
    if (!checkElectronBinary()) process.exit(1);

    const electronBuild = run("npx", ["vite", "build", "--config", "vite.config.ts"]);
    await new Promise((resolve) => electronBuild.on("exit", resolve));

    const devServer = run("npx", ["vite", "--config", "vite.config.ts"]);
    await waitForServer("http://localhost:5391");

    const electronProcess = run(electronBinary, ["."], { VITE_DEV_SERVER_URL: "http://localhost:5391" });

    const shutdown = (code = 0) => {
        devServer.kill();
        electronProcess.kill();
        process.exit(code);
    };

    electronProcess.on("exit", (code) => shutdown(code ?? 0));
    devServer.on("exit", (code) => {
        if (code) shutdown(code);
    });
    process.on("SIGINT", () => shutdown(0));
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
