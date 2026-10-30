import { describe, expect, it } from "vitest";
import {
    htmlToPlainText,
    looksLikeHtml,
    noteExcerpt,
    plainTextToHtml,
    sanitizeNoteHtml,
    toEditorHtml
} from "@/lib/noteContent";

describe("note content helpers", () => {
    it("treats legacy plain text as text, not markup", () => {
        expect(looksLikeHtml("Just a plain note")).toBe(false);
        expect(toEditorHtml("Just a plain note")).toBe("<p>Just a plain note</p>");
    });

    it("leaves real HTML untouched when loading the editor", () => {
        const html = "<p>Hello <b>world</b></p>";
        expect(looksLikeHtml(html)).toBe(true);
        expect(toEditorHtml(html)).toBe(html);
    });

    it("converts paragraphs and line breaks from plain text", () => {
        expect(plainTextToHtml("one\ntwo\n\nthree")).toBe("<p>one<br>two</p><p>three</p>");
    });

    it("extracts readable text for previews and search", () => {
        expect(htmlToPlainText("<p>Hello <b>world</b></p><p>Second</p>")).toContain("Hello world");
        expect(htmlToPlainText("<p>Hello <b>world</b></p>")).not.toContain("<");
        expect(htmlToPlainText("plain body")).toBe("plain body");
    });

    it("builds a one-line excerpt from rich content", () => {
        const excerpt = noteExcerpt("<p>Line one</p><p>Line two</p>");
        expect(excerpt).toBe("Line one Line two");
        expect(excerpt).not.toContain("<p>");
    });

    it("keeps formatting tags but drops scripts and event handlers", () => {
        const cleaned = sanitizeNoteHtml(
            '<p onclick="alert(1)">Safe <b>bold</b></p><script>alert(1)</script>'
        );
        expect(cleaned).toContain("<b>bold</b>");
        expect(cleaned).not.toContain("script");
        expect(cleaned).not.toContain("onclick");
    });

    it("strips javascript: links but keeps http links", () => {
        expect(sanitizeNoteHtml('<a href="javascript:alert(1)">x</a>')).not.toContain("javascript:");
        expect(sanitizeNoteHtml('<a href="https://example.com">x</a>')).toContain("https://example.com");
    });
});
