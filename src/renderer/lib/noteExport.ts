import { toEditorHtml } from "./noteContent";

/**
 * Conversion of a stored note body (HTML) into the text formats users expect to
 * take away: Markdown and plain text.
 *
 * The editor writes a small, known subset of HTML (see `sanitizeNoteHtml`), so
 * this module maps exactly that subset back to Markdown. Anything unknown is
 * kept as text rather than dropped, which matches how the sanitizer treats it.
 */

/**
 * Escape the characters that would otherwise be read as Markdown syntax.
 *
 * ─── OLD CODE (kept for reference) ───
 * return text.replace(/([\\`*_[\]()#+\-.!>])/g, "\\$1");
 * Escaping every `.` turned ordinary prose into `end\.` and made exported
 * notes hard to read and edit. Only characters that actually start or close
 * inline syntax are escaped here.
 */
function escapeMarkdown(text: string): string {
    return text.replace(/([\\`*_[\]~])/g, "\\$1");
}

/** Inline formatting inside a block: bold, italic, code, strike, links. */
function inlineToMarkdown(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
        return escapeMarkdown(node.textContent ?? "");
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return "";

    const element = node as HTMLElement;
    const inner = Array.from(element.childNodes).map(inlineToMarkdown).join("");

    switch (element.tagName) {
        case "BR":
            // A <br> is a soft line break inside the same block.
            return "  \n";
        case "STRONG":
        case "B":
            return inner.trim() ? `**${inner}**` : inner;
        case "EM":
        case "I":
            return inner.trim() ? `*${inner}*` : inner;
        case "S":
        case "STRIKE":
            return inner.trim() ? `~~${inner}~~` : inner;
        case "CODE":
            return inner.trim() ? `\`${inner.replace(/`/g, "\\`")}\`` : inner;
        case "A": {
            const href = element.getAttribute("href") ?? "";
            if (!href || !inner.trim()) return inner;
            return `[${inner}](${href})`;
        }
        case "IMG": {
            const src = element.getAttribute("src") ?? "";
            if (!src) return "";
            const alt = element.getAttribute("alt") ?? "";
            return `![${alt}](${src})`;
        }
        default:
            return inner;
    }
}

/** Render one block-level element, including its trailing blank line. */
function blockToMarkdown(element: HTMLElement): string {
    const inline = () => Array.from(element.childNodes).map(inlineToMarkdown).join("").trim();

    switch (element.tagName) {
        case "H1":
            return `# ${inline()}\n\n`;
        case "H2":
            return `## ${inline()}\n\n`;
        case "H3":
            return `### ${inline()}\n\n`;
        case "BLOCKQUOTE": {
            // Prefix every line so multi-line quotes stay inside the block.
            const body = inline()
                .split("\n")
                .map((line) => `> ${line}`)
                .join("\n");
            return `${body}\n\n`;
        }
        case "PRE":
            return `\`\`\`\n${element.textContent ?? ""}\n\`\`\`\n\n`;
        case "UL":
        case "OL": {
            const items = Array.from(element.children).filter((child) => child.tagName === "LI");
            const lines = items.map((item, index) => {
                const marker = element.tagName === "OL" ? `${index + 1}.` : "-";
                const text = Array.from(item.childNodes).map(inlineToMarkdown).join("").trim();
                // Indent continuation lines so nested content stays aligned.
                return `${marker} ${text.replace(/\n/g, "\n  ")}`;
            });
            return `${lines.join("\n")}\n\n`;
        }
        case "LI": {
            // A stray list item outside a list still reads fine as a bullet.
            return `- ${inline()}\n\n`;
        }
        case "DIV":
        case "P":
            return inline() ? `${inline()}\n\n` : "";
        default: {
            // Unknown wrapper: keep the text, drop the tag.
            const text = inline();
            return text ? `${text}\n\n` : "";
        }
    }
}

/**
 * Convert a note body to Markdown.
 *
 * Falls back to plain text when there is no DOM (tests, non-browser contexts),
 * so callers never have to branch on the environment.
 */
export function htmlToMarkdown(html: string): string {
    if (!html) return "";
    if (typeof document === "undefined") return html;

    const holder = document.createElement("div");
    holder.innerHTML = toEditorHtml(html);

    const blocks = Array.from(holder.childNodes)
        .map((node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                const text = (node.textContent ?? "").trim();
                return text ? `${escapeMarkdown(text)}\n\n` : "";
            }
            if (node.nodeType !== Node.ELEMENT_NODE) return "";
            return blockToMarkdown(node as HTMLElement);
        })
        .join("");

    // Normalise to a single blank line between blocks and drop trailing space.
    return blocks.replace(/\n{3,}/g, "\n\n").trimEnd();
}

export interface NoteExport {
    /** Title with characters Windows does not allow in a file name. */
    fileName: string;
    /** Full text that will be written to disk. */
    body: string;
}

/** Characters Windows rejects in a file name, plus trailing dots and spaces. */
function sanitizeFileName(title: string): string {
    const cleaned = title
        .replace(/[\\/:*?"<>|]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        // Windows strips trailing dots and spaces, which would silently change
        // the requested name, so remove them up front.
        .replace(/[. ]+$/, "");
    return cleaned.slice(0, 80) || "Untitled note";
}

/**
 * Build the file contents for an export.
 *
 * Markdown starts with the title as an H1 so the document is self-describing
 * once it leaves the app; plain text starts with the bare title.
 */
export function buildNoteExport(
    note: { title: string; content: string },
    format: "markdown" | "text",
    fallbackTitle = "Untitled note"
): NoteExport {
    const title = note.title.trim() || fallbackTitle;
    const markdown = htmlToMarkdown(note.content);

    if (format === "markdown") {
        // Avoid a doubled heading when the body already opens with one.
        const body = markdown.replace(/^#\s+.*\n+/, "");
        return {
            fileName: `${sanitizeFileName(title)}.md`,
            body: `# ${title}\n\n${body}`.trimEnd() + "\n"
        };
    }

    const plain = markdown
        // Markdown emphasis markers have no meaning in a .txt file.
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/\*([^*]+)\*/g, "$1")
        .replace(/~~([^~]+)~~/g, "$1")
        .replace(/`([^`]+)`/g, "$1");

    return {
        fileName: `${sanitizeFileName(title)}.txt`,
        body: `${title}\n\n${plain}`.trimEnd() + "\n"
    };
}
