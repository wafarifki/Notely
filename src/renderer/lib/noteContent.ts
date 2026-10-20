/**
 * Note bodies are stored as HTML so the WYSIWYG editor can round-trip
 * formatting. Notes written before the editor existed contain plain text, so
 * everything that reads `note.content` goes through these helpers instead of
 * assuming one or the other.
 */

const BLOCK_TAGS = new Set(["P", "DIV", "LI", "H1", "H2", "H3", "BLOCKQUOTE", "PRE", "UL", "OL"]);

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/** Heuristic: does this string already contain markup we produced? */
export function looksLikeHtml(value: string): boolean {
    return /<\/?(p|div|br|b|strong|i|em|u|s|ul|ol|li|h[1-6]|blockquote|a|pre|code)\b/i.test(value);
}

/** Convert a legacy plain-text body into editor-ready HTML. */
export function plainTextToHtml(value: string): string {
    if (!value.trim()) return "";
    return value
        .split(/\n{2,}/)
        .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`)
        .join("");
}

/** Coerce any stored body into HTML, leaving real HTML untouched. */
export function toEditorHtml(content: string): string {
    if (!content) return "";
    return looksLikeHtml(content) ? content : plainTextToHtml(content);
}

/**
 * Extract readable text for previews, search and activity titles.
 * Uses the DOM when available (accurate), and falls back to tag-stripping in
 * non-browser environments such as tests.
 */
export function htmlToPlainText(html: string): string {
    if (!html) return "";
    if (!looksLikeHtml(html)) return html;
    if (typeof document !== "undefined") {
        const holder = document.createElement("div");
        holder.innerHTML = html;
        // Block elements should read as separate lines, not run together.
        holder.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
        holder.querySelectorAll([...BLOCK_TAGS].map((t) => t.toLowerCase()).join(",")).forEach((node) => {
            node.append("\n");
        });
        return (holder.textContent ?? "").replace(/\n{3,}/g, "\n\n").trim();
    }
    return html
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/(p|div|li|h[1-6]|blockquote|pre)>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

/** One-line, length-capped excerpt for note cards. */
export function noteExcerpt(content: string, max = 260): string {
    const text = htmlToPlainText(content).replace(/\s+/g, " ").trim();
    if (!text) return "";
    if (text.length <= max) return text;
    return `${text.slice(0, max).trimEnd()}...`;
}

/**
 * Strip anything that could execute. The editor only emits formatting tags, so
 * the allowlist below is intentionally small; unknown tags are unwrapped so
 * their text survives rather than disappearing.
 */
export function sanitizeNoteHtml(html: string): string {
    if (!html) return "";
    if (typeof document === "undefined") {
        // No DOM available: refuse anything that looks script-like.
        return /<\s*(script|iframe|object|embed)/i.test(html) ? "" : html;
    }
    const template = document.createElement("template");
    template.innerHTML = html;

    const allowed = new Set([
        "P", "DIV", "BR", "B", "STRONG", "I", "EM", "U", "S", "STRIKE",
        "UL", "OL", "LI", "H1", "H2", "H3", "BLOCKQUOTE", "A", "PRE", "CODE", "SPAN"
    ]);

    const walk = (node: Element) => {
        for (const child of Array.from(node.children)) {
            if (!allowed.has(child.tagName)) {
                // Keep the text, drop the wrapper.
                child.replaceWith(...Array.from(child.childNodes));
                return walk(node);
            }
            // Only http(s) links survive; everything else loses its href.
            if (child.tagName === "A") {
                const href = child.getAttribute("href") ?? "";
                if (!/^https?:\/\//i.test(href)) child.removeAttribute("href");
                child.setAttribute("rel", "noreferrer noopener");
                child.setAttribute("target", "_blank");
            } else {
                for (const attr of Array.from(child.attributes)) {
                    if (attr.name !== "class") child.removeAttribute(attr.name);
                }
            }
            walk(child);
        }
    };
    walk(template.content as unknown as Element);
    return template.innerHTML;
}
