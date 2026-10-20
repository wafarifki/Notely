import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..").toLowerCase();

function listNodeProcesses() {
    if (process.platform !== "win32") return [];
    const result = spawnSync(
        "powershell",
        [
            "-NoProfile",
            "-Command",
            "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress"
        ],
        { encoding: "utf8" }
    );
    if (result.status !== 0 || !result.stdout.trim()) return [];
    const parsed = JSON.parse(result.stdout);
    return Array.isArray(parsed) ? parsed : [parsed];
}

const stale = listNodeProcesses().filter((entry) => {
    const command = (entry.CommandLine ?? "").toLowerCase();
    if (!command.includes(root)) return false;
    if (command.includes("node_modules\\.bin") || command.includes("node_modules/vite") || command.includes("vite.js")) {
        return true;
    }
    return command.includes("scripts\\dev.mjs") || command.includes("scripts/dev.mjs");
});

if (stale.length > 0) {
    for (const entry of stale) {
        spawnSync("taskkill", ["/PID", String(entry.ProcessId), "/F", "/T"], { stdio: "ignore" });
    }
    console.log(`Stopped ${stale.length} leftover dev server process(es) from a previous run.`);
}
