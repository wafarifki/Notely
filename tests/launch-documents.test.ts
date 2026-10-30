import { afterAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseLaunchArgs, readDocument } from "../src/main/documents";

const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "notely-docs-"));

afterAll(() => {
    fs.rmSync(workDir, { recursive: true, force: true });
});

describe("parseLaunchArgs", () => {
    it("recognises the context-menu verbs in both spellings", () => {
        expect(parseLaunchArgs(["notely.exe", "--app-task"])).toEqual({ kind: "task" });
        expect(parseLaunchArgs(["notely.exe", "--app task"])).toEqual({ kind: "task" });
        expect(parseLaunchArgs(["notely.exe", "--app-note"])).toEqual({ kind: "note" });
        expect(parseLaunchArgs(["notely.exe", "--app-notes"])).toEqual({ kind: "note" });
    });

    it("treats a supported document path as a file intent", () => {
        const file = path.join(workDir, "shopping.md");
        expect(parseLaunchArgs(["notely.exe", file])).toEqual({ kind: "file", path: file });
    });

    it("ignores switches, placeholders and unsupported extensions", () => {
        expect(parseLaunchArgs(["notely.exe", "--no-sandbox"])).toBeNull();
        expect(parseLaunchArgs(["notely.exe", '"%1"'])).toBeNull();
        expect(parseLaunchArgs(["notely.exe", path.join(workDir, "photo.png")])).toBeNull();
        expect(parseLaunchArgs([])).toBeNull();
    });
});

describe("readDocument", () => {
    it("converts a .txt file into paragraph HTML and uses the first line as the title", () => {
        const file = path.join(workDir, "notes.txt");
        fs.writeFileSync(file, "Groceries\nmilk & eggs\n\nSecond block <b>", "utf8");

        const document = readDocument(file);

        expect(document?.title).toBe("Groceries");
        expect(document?.kind).toBe("text");
        expect(document?.sourcePath).toBe(path.resolve(file));
        expect(document?.content).toContain("<p>Groceries<br>milk &amp; eggs</p>");
        // Raw markup in a text file must be escaped, never executed.
        expect(document?.content).toContain("&lt;b&gt;");
    });

    it("understands the markdown subset used by notes", () => {
        const file = path.join(workDir, "readme.md");
        fs.writeFileSync(
            file,
            ["# Heading", "", "Some **bold** and `code`.", "", "- one", "- two", "", "> quote"].join("\n"),
            "utf8"
        );

        const document = readDocument(file);

        expect(document?.title).toBe("Heading");
        expect(document?.kind).toBe("markdown");
        expect(document?.content).toContain("<h1>Heading</h1>");
        expect(document?.content).toContain("<strong>bold</strong>");
        expect(document?.content).toContain("<code>code</code>");
        expect(document?.content).toContain("<ul><li>one</li><li>two</li></ul>");
        expect(document?.content).toContain("<blockquote>quote</blockquote>");
    });

    it("returns null for a file that does not exist", () => {
        expect(readDocument(path.join(workDir, "missing.txt"))).toBeNull();
    });
});
