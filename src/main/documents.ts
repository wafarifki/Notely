import fs from "node:fs";
import path from "node:path";
import type { LaunchIntent } from "./channels";

/** Extensions Notely can open from Explorer. */
const SUPPORTED_EXTENSIONS = new Set([".txt", ".md", ".markdown", ".mdown"]);

/** Files above this size are almost never prose; refuse rather than blow up IndexedDB. */
const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

export function isSupportedDocument(filePath: string): boolean {
    return SUPPORTED_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

/**
 * Is `candidate` an absolute path? Windows registry invocations can carry
 * `%1` placeholders, relative paths or switches, and Electron's argv always
 * starts with the executable — none of those are documents.
 */
function looksLikePath(candidate: string): boolean {
    if (!candidate || candidate.startsWith("-") || candidate.includes("%")) return false;
    if (!isSupportedDocument(candidate)) return false;
    return path.isAbsolute(candidate) || /^[a-zA-Z]:[\\/]/.test(candidate);
}

/**
 * Turn a command line into a launch intent.
 *
 * `argv` is whatever arrived: Electron's own argv on first launch, the argv of
 * a `second-instance` event, or a human typing `notely --app-task` in a shell.
 * Flags are matched both as `--app-task` and `--app task` because that is how
 * electron-builder writes the registry command.
 */
export function parseLaunchArgs(argv: readonly string[]): LaunchIntent | null {
    const args = argv.map((value) => value.trim()).filter(Boolean);
    const lower = args.map((value) => value.toLowerCase());

    const hasVerb = (verb: string) =>
        lower.some((value) => value === `--app-${verb}` || value === `--app ${verb}`);

    // ─── OLD CODE (kept for reference) ───
    // The file path was checked first:
    //
    // for (const candidate of args) {
    //     if (looksLikePath(candidate)) return { kind: "file", path: path.resolve(candidate) };
    // }
    // if (hasVerb("task")) return { kind: "task" };
    //
    // That meant the context-menu command `notely.exe --app-task "%V"` ran the
    // file branch whenever the clicked folder happened to be named `notes.txt`
    // (or any `.md` name). The explicit verb must win over an incidental path.
    //
    // ─── NEW: an explicit context-menu verb always takes priority. ───
    if (hasVerb("task")) return { kind: "task" };
    // "Create New Notes" uses the plural in the menu label; both spellings map
    // to the same blank-note action.
    if (hasVerb("notes") || hasVerb("note")) return { kind: "note" };

    // A file association launch looks like `notely.exe "C:\…\note.md"`.
    for (const candidate of args) {
        if (looksLikePath(candidate)) {
            return { kind: "file", path: path.resolve(candidate) };
        }
    }
    return null;
}

export type ImportKind = "markdown" | "text";

export interface ImportedDocument {
    title: string;
    /** HTML ready for the WYSIWYG editor. */
    content: string;
    /** The remembered origin, so a second open of the same file reuses the note. */
    sourcePath: string;
    kind: ImportKind;
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/**
 * A deliberately small Markdown subset: headings, bullets, numbered items,
 * quotes, code, bold/italic/inline code, autolinks and images. Anything else is
 * kept as escaped text rather than silently dropped.
 */
function markdownToHtml(markdown: string): string {
    const inline = (raw: string): string => {
        let text = escapeHtml(raw);
        text = text.replace(/!\[([^\]]*)\]\((\S+?)\)/g, (_m, alt: string, src: string) => {
            if (!/^(https?:\/\/|data:image\/)/i.test(src)) return alt;
            // Alignment lives in the style attribute so the shared sanitizer
            // treats imported images exactly like pasted ones.
            return `<img src="${src}" alt="${alt}" style="display:block;margin:0 auto;max-width:100%">`;
        });
        text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" rel="noreferrer noopener" target="_blank">$1</a>');
        text = text.replace(/`([^`]+)`/g, "<code>$1</code>");
        text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
        text = text.replace(/__([^_]+)__/g, "<strong>$1</strong>");
        text = text.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
        text = text.replace(/(https?:\/\/[^\s<]+)/g, (url) => {
            return url.includes("</a>") ? url : `<a href="${url}" rel="noreferrer noopener" target="_blank">${url}</a>`;
        });
        return text;
    };

    const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
    const out: string[] = [];
    let list: "ul" | "ol" | null = null;
    let code: string[] | null = null;
    let paragraph: string[] = [];

    const flushParagraph = () => {
        if (paragraph.length === 0) return;
        out.push(`<p>${paragraph.map(inline).join("<br>")}</p>`);
        paragraph = [];
    };
    const closeList = () => {
        if (!list) return;
        out.push(`</${list}>`);
        list = null;
    };

    for (const line of lines) {
        if (code) {
            if (/^\s*```/.test(line)) {
                out.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
                code = null;
            } else {
                code.push(line);
            }
            continue;
        }
        if (/^\s*```/.test(line)) {
            flushParagraph();
            closeList();
            code = [];
            continue;
        }
        if (!line.trim()) {
            flushParagraph();
            closeList();
            continue;
        }
        const heading = /^(#{1,3})\s+(.*)$/.exec(line);
        if (heading) {
            flushParagraph();
            closeList();
            const level = heading[1].length;
            out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
            continue;
        }
        const quote = /^>\s?(.*)$/.exec(line);
        if (quote) {
            flushParagraph();
            closeList();
            out.push(`<blockquote>${inline(quote[1])}</blockquote>`);
            continue;
        }
        const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
        if (bullet) {
            flushParagraph();
            if (list !== "ul") {
                closeList();
                out.push("<ul>");
                list = "ul";
            }
            out.push(`<li>${inline(bullet[1])}</li>`);
            continue;
        }
        const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
        if (numbered) {
            flushParagraph();
            if (list !== "ol") {
                closeList();
                out.push("<ol>");
                list = "ol";
            }
            out.push(`<li>${inline(numbered[1])}</li>`);
            continue;
        }
        closeList();
        paragraph.push(line);
    }

    if (code) out.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
    flushParagraph();
    closeList();
    return out.join("");
}

function plainTextToHtml(text: string): string {
    return text
        .replace(/\r\n?/g, "\n")
        .split(/\n{2,}/)
        .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`)
        .join("");
}

/** Derive the note title from the first non-empty line / heading. */
function deriveTitle(raw: string, fallback: string): string {
    for (const line of raw.replace(/\r\n?/g, "\n").split("\n")) {
        const cleaned = line
            .replace(/^\s{0,3}#{1,6}\s*/, "")
            .replace(/^\s*(?:[-*+]|\d+[.)])\s+/, "")
            .trim();
        if (cleaned) return cleaned.slice(0, 200);
    }
    return fallback;
}

/**
 * Read a `.txt` / `.md` file from disk and convert it to an editable note body.
 * Returns `null` for anything unreadable so the caller can fall back to a
 * plain "create note" behaviour instead of crashing.
 */
export function readDocument(filePath: string): ImportedDocument | null {
    try {
        const stats = fs.statSync(filePath);
        if (!stats.isFile() || stats.size > MAX_IMPORT_BYTES) return null;
        const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
        const kind: ImportKind = /\.(md|markdown|mdown)$/i.test(filePath) ? "markdown" : "text";
        const fallbackTitle = path.basename(filePath, path.extname(filePath));
        return {
            title: deriveTitle(raw, fallbackTitle),
            content: kind === "markdown" ? markdownToHtml(raw) : plainTextToHtml(raw),
            sourcePath: path.resolve(filePath),
            kind
        };
    } catch {
        return null;
    }
}

