import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = join(root, "_screenshots");
const baseUrl = process.env.APP_URL ?? "http://localhost:5391";

const shots = [
    { name: "home-1504x1128", width: 1504, height: 1128, hash: "#/" },
    { name: "home-1024x768", width: 1024, height: 768, hash: "#/" },
    { name: "home-390x844", width: 390, height: 844, hash: "#/" },
    { name: "notes", width: 1504, height: 1128, hash: "#/notes" },
    { name: "tasks", width: 1504, height: 1128, hash: "#/tasks" },
    { name: "project", width: 1504, height: 1128, hash: "#/projects/seed-project-workshop" },
    { name: "settings", width: 1504, height: 1128, hash: "#/settings" }
];

async function main() {
    await mkdir(outputDir, { recursive: true });
    const browser = await chromium.launch();
    for (const shot of shots) {
        const context = await browser.newContext({
            viewport: { width: shot.width, height: shot.height },
            deviceScaleFactor: 1
        });
        const page = await context.newPage();
        await page.goto(`${baseUrl}/${shot.hash}`, { waitUntil: "networkidle" });
        await page.waitForTimeout(900);
        await page.screenshot({ path: join(outputDir, `${shot.name}.png`) });
        console.log("captured", shot.name);
        await context.close();
    }
    await browser.close();
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
