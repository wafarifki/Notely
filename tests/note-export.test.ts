import { describe, expect, it } from "vitest";
import { buildNoteExport, htmlToMarkdown } from "@/lib/noteExport";

describe("htmlToMarkdown", () => {
    it("maps the editor's block tags to Markdown", () => {
        const html = "<h1>Title</h1><p>Body text</p><h2>Section</h2><p>More</p>";

        expect(htmlToMarkdown(html)).toBe("# Title\n\nBody text\n\n## Section\n\nMore");
    });

    it("keeps inline emphasis, code and strikethrough", () => {
        const html = "<p>Some <strong>bold</strong>, <em>italic</em>, <code>x = 1</code> and <s>gone</s>.</p>";

        expect(htmlToMarkdown(html)).toBe("Some **bold**, *italic*, `x = 1` and ~~gone~~.");
    });

    it("converts links and images", () => {
        const html = '<p><a href="https://example.com">site</a> <img src="https://example.com/a.png" alt="pic"></p>';

        expect(htmlToMarkdown(html)).toBe("[site](https://example.com) ![pic](https://example.com/a.png)");
    });

    it("converts lists, quotes and code blocks", () => {
        const html =
            "<ul><li>one</li><li>two</li></ul>" +
            "<ol><li>first</li><li>second</li></ol>" +
            "<blockquote>quoted</blockquote>" +
            "<pre>line 1\nline 2</pre>";

        const markdown = htmlToMarkdown(html);

        expect(markdown).toContain("- one\n- two");
        expect(markdown).toContain("1. first\n2. second");
        expect(markdown).toContain("> quoted");
        expect(markdown).toContain("```\nline 1\nline 2\n```");
    });

    it("treats a legacy plain-text body as text", () => {
        expect(htmlToMarkdown("Just plain text")).toBe("Just plain text");
    });

    it("escapes characters that would otherwise become syntax", () => {
        expect(htmlToMarkdown("<p>1 * 2 = 2</p>")).toBe("1 \\* 2 = 2");
    });

    it("leaves ordinary punctuation such as periods untouched", () => {
        expect(htmlToMarkdown("<p>Done. Next sentence.</p>")).toBe("Done. Next sentence.");
    });
});

describe("buildNoteExport", () => {
    const note = { title: "My Note", content: "<p>Hello <strong>world</strong></p>" };

    it("prefixes Markdown with the title as a heading", () => {
        const result = buildNoteExport(note, "markdown");

        expect(result.fileName).toBe("My Note.md");
        expect(result.body).toContain("# My Note");
        expect(result.body).toContain("Hello **world**");
    });

    it("strips Markdown markers for the plain-text variant", () => {
        const result = buildNoteExport(note, "text");

        expect(result.fileName).toBe("My Note.txt");
        expect(result.body).toContain("Hello world");
        expect(result.body).not.toContain("**");
    });

    it("avoids duplicating a heading the body already starts with", () => {
        const withHeading = { title: "Same", content: "<h1>Same</h1><p>Body</p>" };

        const body = buildNoteExport(withHeading, "markdown").body;

        expect(body.match(/# Same/g)).toHaveLength(1);
    });

    it("sanitises characters Windows forbids in file names", () => {
        const result = buildNoteExport({ title: 'a/b:c*d?"e<f>g|h', content: "<p>x</p>" }, "markdown");

        expect(result.fileName).toBe("a b c d e f g h.md");
    });

    it("falls back to a usable name for an empty title", () => {
        const result = buildNoteExport({ title: "   ", content: "" }, "text", "Untitled note");

        expect(result.fileName).toBe("Untitled note.txt");
    });

    it("ends the file with a single trailing newline", () => {
        const result = buildNoteExport(note, "text");

        expect(result.body.endsWith("\n")).toBe(true);
        expect(result.body.endsWith("\n\n")).toBe(false);
    });
});
