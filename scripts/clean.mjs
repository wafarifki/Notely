import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const processNames = ["Notely.exe", "electron.exe"];

function stopProcesses() {
    for (const name of processNames) {
        const result = spawnSync("taskkill", ["/F", "/IM", name, "/T"], {
            stdio: "ignore",
            shell: process.platform === "win32"
        });
        if (result.status === 0) {
            console.log(`Stopped ${name}`);
        }
    }
}

function remove(path) {
    rmSync(path, { recursive: true, force: true });
}

stopProcesses();

for (const folder of ["release", "dist", "dist-electron", ".stage-app"]) {
    remove(join(root, folder));
    console.log(`Removed ${folder}/`);
}

console.log("Clean done. If npm still reports EPERM, close other terminals running `npm run dev` / vite.");
