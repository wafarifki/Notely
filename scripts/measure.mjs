import { chromium } from "playwright";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = process.env.APP_URL ?? "http://localhost:5391";
const hash = process.argv[2] ?? "#/";
const width = Number(process.argv[3] ?? 1504);
const height = Number(process.argv[4] ?? 1128);

const browser = await chromium.launch();
const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    storageState: join(root, "_screenshots", "state.json")
});
const page = await context.newPage();
await page.goto(`${baseUrl}/${hash}`, { waitUntil: "networkidle" });
await page.waitForSelector(".dashboard, .page", { timeout: 20000 });
await page.waitForTimeout(500);

const result = await page.evaluate(() => {
    const box = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)];
    };
    const all = (selector) => [...document.querySelectorAll(selector)].map(box);
    const fontSize = (selector) => {
        const el = document.querySelector(selector);
        return el ? getComputedStyle(el).fontSize : null;
    };
    return {
        panel: box(document.querySelector(".app-panel")),
        sidebar: box(document.querySelector(".app-sidebar")),
        welcome: box(document.querySelector(".welcome-title")),
        mainScroll: box(document.querySelector(".app-scroll")),
        leftCol: box(document.querySelector(".dashboard-column-left")),
        rightCol: box(document.querySelector(".dashboard-column-right")),
        sections: [...document.querySelectorAll(".dashboard-section")].map((el) => [el.className, box(el)]),
        headers: [...document.querySelectorAll(".section-header")].map(box),
        grid: box(document.querySelector(".projects-grid")),
        cards: all(".folder-card"),
        dropSlots: all(".drop-slot"),
        noteCards: all(".note-card"),
        tagRows: all(".note-card-tags"),
        tasksPanel: box(document.querySelector(".tasks-panel")),
        taskRows: all(".task-row"),
        activityPanel: box(document.querySelector(".dashboard-panel, .activity-panel")),
        activityRows: all(".activity-row"),
        fontSize: {
            welcome: fontSize(".welcome-title"),
            section: fontSize(".section-title"),
            cardTitle: fontSize(".folder-card-title"),
            noteTitle: fontSize(".note-card-title"),
            excerpt: fontSize(".note-card-excerpt"),
            date: fontSize(".folder-card-date"),
            taskTitle: fontSize(".task-row-title"),
            taskMeta: fontSize(".task-row-meta"),
            actor: fontSize(".activity-actor"),
            detail: fontSize(".activity-detail")
        },
        overflowX: document.documentElement.scrollWidth > window.innerWidth,
        mainOverflow: (() => {
            const el = document.querySelector(".app-scroll");
            return el ? el.scrollHeight > el.clientHeight + 1 : null;
        })()
    };
});

console.log(JSON.stringify(result, null, 1));
await browser.close();
