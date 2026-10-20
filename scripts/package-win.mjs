import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const electronBinary = join(root, "node_modules", "electron", "dist", "electron.exe");

if (!existsSync(electronBinary)) {
    console.error("Electron binary is missing. Run `node node_modules/electron/install.js` first.");
    process.exit(1);
}

const unpackedDist = join(root, ".cache", "electron-dist");
const sourceDist = join(root, "node_modules", "electron", "dist");

rmSync(unpackedDist, { recursive: true, force: true });
cpSync(sourceDist, unpackedDist, { recursive: true });

const targets = process.argv.slice(2);
const targetArgs = targets.flatMap((target) => ["--win", target]);
const args = ["electron-builder", ...(targetArgs.length > 0 ? targetArgs : ["--win", "nsis", "--win", "portable"]), "--x64"];
const cacheRoot = join(process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local"), "NotelyBuildCache");
mkdirSync(cacheRoot, { recursive: true });

const environment = {
    ...process.env,
    ELECTRON_BUILDER_CACHE: process.env.ELECTRON_BUILDER_CACHE ?? join(cacheRoot, "electron-builder"),
    ELECTRON_CACHE: process.env.ELECTRON_CACHE ?? join(cacheRoot, "electron")
};

function run() {
    return spawnSync("npx", args, {
        cwd: root,
        stdio: "inherit",
        shell: process.platform === "win32",
        env: environment
    }).status;
}

let status = run();
if (status !== 0) {
    console.warn("Packaging failed; clearing the tool cache and retrying once.");
    rmSync(environment.ELECTRON_BUILDER_CACHE, { recursive: true, force: true });
    status = run();
    if (status !== 0) {
        console.error(
            "Packaging failed twice. Close any running Notes/electron processes, delete the release folder and retry."
        );
    }
}

process.exit(status ?? 1);
