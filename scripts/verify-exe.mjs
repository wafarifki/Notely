import { _electron as electron } from "playwright";
import { existsSync, readdirSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const releaseDir = join(root, "release");
const outputDir = join(root, "_screenshots", "desktop");
mkdirSync(outputDir, { recursive: true });

function findPackagedExecutable() {
    if (!existsSync(releaseDir)) {
        throw new Error("release/ does not exist. Run `npm run dist:all` first.");
    }
    const unpacked = join(releaseDir, "win-unpacked", "Notely.exe");
    if (existsSync(unpacked)) return unpacked;
    const portable = readdirSync(releaseDir).find((file) => file.endsWith("-portable.exe"));
    if (portable) return join(releaseDir, portable);
    throw new Error("No packaged Notely.exe found in release/.");
}

const executable = process.argv[2] ?? findPackagedExecutable();
console.log("Launching", executable);

const app = await electron.launch({
    executablePath: executable,
    args: []
});

try {
    const page = await app.firstWindow();
    await page.waitForLoadState("domcontentloaded");
    await page.waitForSelector(".dashboard", { timeout: 30000 });
    await page.waitForTimeout(1500);

    const info = await page.evaluate(() => ({
        title: document.title,
        welcome: document.querySelector(".welcome-title")?.textContent ?? null,
        cards: document.querySelectorAll(".folder-card").length,
        tasks: document.querySelectorAll(".task-row").length,
        notes: document.querySelectorAll(".note-card").length,
        activity: document.querySelectorAll(".activity-row").length,
        hasWindowControls: Boolean(document.querySelector(".window-controls")),
        nodeIntegration: typeof window.require,
        width: window.innerWidth,
        height: window.innerHeight
    }));

    console.log(JSON.stringify(info, null, 1));
    await page.screenshot({ path: join(outputDir, "home.png") });

    const bounds = await app.evaluate(async ({ BrowserWindow }) => {
        const win = BrowserWindow.getAllWindows()[0];
        return { bounds: win.getBounds(), maximized: win.isMaximized() };
    });
    console.log("window bounds", JSON.stringify(bounds));

    if (info.nodeIntegration !== "undefined") {
        throw new Error("Renderer is exposed to Node. nodeIntegration must stay disabled.");
    }

    await app.close();
    console.log("Packaged app launched, rendered the dashboard and closed cleanly.");
} catch (error) {
    await app.close().catch(() => undefined);
    console.error(error);
    process.exit(1);
}
