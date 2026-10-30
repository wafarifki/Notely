import { describe, expect, it } from "vitest";
import { looksLikeHtml, sanitizeNoteHtml } from "@/lib/noteContent";

describe("sanitizeNoteHtml with images", () => {
    it("keeps inline data-URL images and their alignment/size", () => {
        const html =
            '<p>Before</p><img src="data:image/png;base64,AAAA" alt="shot" style="display:block;margin:0 auto;width:55%" loading="lazy">';

        const result = sanitizeNoteHtml(html);

        expect(result).toContain('src="data:image/png;base64,AAAA"');
        expect(result).toContain("width:55%");
        expect(result).toContain("margin:0 auto");
        expect(result).toContain("<p>Before</p>");
    });

    it("drops images with unsafe sources but keeps the surrounding text", () => {
        const result = sanitizeNoteHtml('<p>keep</p><img src="file:///C:/secret.png"><img src="javascript:alert(1)">');

        expect(result).toBe("<p>keep</p>");
    });

    it("strips style declarations the editor never writes", () => {
        const result = sanitizeNoteHtml(
            '<img src="https://example.com/a.png" style="position:fixed;display:block;margin:0 0 0 auto;width:40%">'
        );

        expect(result).not.toContain("position");
        expect(result).toContain("display:block");
        expect(result).toContain("width:40%");
    });

    it("still removes scripts and unknown wrappers", () => {
        const result = sanitizeNoteHtml("<script>alert(1)</script><marquee>hi</marquee>");

        expect(result).not.toContain("script");
        expect(result).toContain("hi");
    });
});

describe("looksLikeHtml", () => {
    it("recognises an image-only body as HTML", () => {
        expect(looksLikeHtml('<img src="data:image/png;base64,AAAA">')).toBe(true);
    });
});
