import { useCallback, useEffect, useRef, useState } from "react";
import {
    Bold,
    Italic,
    Link2,
    List,
    ListOrdered,
    Quote,
    Redo2,
    Strikethrough,
    Underline,
    Undo2
} from "lucide-react";
import { useI18n } from "@/i18n";
import type { TranslationKey } from "@/i18n/translations";
import { toEditorHtml } from "@/lib/noteContent";

export type EditorCommand =
    | "bold"
    | "italic"
    | "underline"
    | "strikeThrough"
    | "insertUnorderedList"
    | "insertOrderedList"
    | "undo"
    | "redo";

interface RichTextApi {
    run(command: EditorCommand): void;
    /** Blocks are applied to the caret's paragraph (or the selection). */
    block(tag: "blockquote" | "p"): void;
    link(url: string): void;
    getSelectionText(): string;
}

/** Legacy shape kept out of the public surface. */
type LegacyExec = (command: string, arg?: string) => void;

interface ToolbarButton {
    key: string;
    labelKey: TranslationKey;
    icon: typeof Bold;
    run: (api: RichTextApi) => void;
}

/**
 * A small, dependency-free rich text editor.
 *
 * `document.execCommand` is formally deprecated but remains the only way to get
 * reliable in-place editing without shipping a framework, and every Chromium
 * version Electron ships still implements it correctly. The alternative
 * (CKEditor/ProseMirror) adds about a megabyte to an offline-first desktop app.
 */
export function RichTextEditor({
    value,
    onChange,
    placeholder,
    ariaLabel
}: {
    value: string;
    onChange: (html: string) => void;
    placeholder: string;
    ariaLabel: string;
}) {
    const { t } = useI18n();
    const editorRef = useRef<HTMLDivElement>(null);
    // ─── OLD CODE (kept for reference) ───
    // const lastValueRef = useRef<string>(value);
    // ─── NEW: seeding this with `value` meant the first effect saw
    // value === lastValueRef.current, skipped the DOM write, and the editor
    // opened empty even though the note had content. Start at null so the very
    // first render always paints the stored body. ───
    const lastValueRef = useRef<string | null>(null);
    // Electron does not implement window.prompt(), so linking uses an inline field.
    const [linkOpen, setLinkOpen] = useState(false);
    const [linkUrl, setLinkUrl] = useState("https://");
    // Keep the selection while the link field has focus.
    const savedRangeRef = useRef<Range | null>(null);

    function rememberSelection() {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
            savedRangeRef.current = selection.getRangeAt(0).cloneRange();
        }
    }

    function restoreSelection() {
        const selection = window.getSelection();
        if (!selection || !savedRangeRef.current) return;
        selection.removeAllRanges();
        selection.addRange(savedRangeRef.current);
    }

    function commitLink() {
        const url = linkUrl.trim();
        setLinkOpen(false);
        if (!/^https?:\/\//i.test(url)) return;
        editorRef.current?.focus();
        restoreSelection();
        document.execCommand("createLink", false, url);
        // Links must never navigate away from the app window.
        editorRef.current?.querySelectorAll("a[href]").forEach((anchor) => {
            anchor.setAttribute("target", "_blank");
            anchor.setAttribute("rel", "noreferrer noopener");
        });
        emit();
    }

    useEffect(() => {
        const node = editorRef.current;
        if (!node) return;
        // Only overwrite the DOM when the incoming value differs from what we
        // last emitted, otherwise every keystroke would reset the caret.
        if (value === lastValueRef.current) return;
        const next = toEditorHtml(value);
        if (node.innerHTML !== next) node.innerHTML = next;
        lastValueRef.current = value;
    }, [value]);

    const emit = useCallback(() => {
        const html = editorRef.current?.innerHTML ?? "";
        lastValueRef.current = html;
        onChange(html);
    }, [onChange]);

    const exec: LegacyExec = useCallback(
        (command: string, arg?: string) => {
            const node = editorRef.current;
            if (!node) return;
            node.focus();
            document.execCommand(command, false, arg);
            emit();
        },
        [emit]
    );

    const api: RichTextApi = {
        run: (command) => exec(command),
        block: (tag) => exec("formatBlock", tag),
        link: (url) => {
            exec("createLink", url);
            // Links must never navigate away from the app window.
            editorRef.current?.querySelectorAll("a[href]").forEach((anchor) => {
                anchor.setAttribute("target", "_blank");
                anchor.setAttribute("rel", "noreferrer noopener");
            });
        },
        getSelectionText: () => window.getSelection()?.toString() ?? ""
    };

    const buttons: (ToolbarButton | "divider")[] = [
        { key: "bold", labelKey: "note.bold", icon: Bold, run: (a) => a.run("bold") },
        { key: "italic", labelKey: "note.italic", icon: Italic, run: (a) => a.run("italic") },
        { key: "underline", labelKey: "note.underline", icon: Underline, run: (a) => a.run("underline") },
        { key: "strike", labelKey: "note.strike", icon: Strikethrough, run: (a) => a.run("strikeThrough") },
        "divider",
        { key: "ul", labelKey: "note.bulletedList", icon: List, run: (a) => a.run("insertUnorderedList") },
        { key: "ol", labelKey: "note.numberedList", icon: ListOrdered, run: (a) => a.run("insertOrderedList") },
        { key: "quote", labelKey: "note.quote", icon: Quote, run: (a) => a.block("blockquote") },
        "divider",
        {
            key: "link",
            labelKey: "note.link",
            icon: Link2,
            run: (a) => {
                // A link needs text to wrap; without a selection there is nothing to link.
                if (!a.getSelectionText()) return;
                rememberSelection();
                setLinkOpen(true);
            }
        },
        "divider",
        { key: "undo", labelKey: "note.undo", icon: Undo2, run: (a) => a.run("undo") },
        { key: "redo", labelKey: "note.redo", icon: Redo2, run: (a) => a.run("redo") }
    ];

    return (
        <div className="rte">
            {linkOpen ? (
                <div className="rte-link-row">
                    <input
                        className="text-input"
                        type="url"
                        value={linkUrl}
                        aria-label={t("note.linkPrompt")}
                        autoFocus
                        onChange={(event) => setLinkUrl(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter") {
                                event.preventDefault();
                                commitLink();
                            } else if (event.key === "Escape") {
                                event.preventDefault();
                                setLinkOpen(false);
                            }
                        }}
                    />
                    <button type="button" className="button button-primary button-small" onClick={commitLink}>
                        {t("note.linkApply")}
                    </button>
                    <button
                        type="button"
                        className="button button-ghost button-small"
                        onClick={() => setLinkOpen(false)}
                    >
                        {t("common.cancel")}
                    </button>
                </div>
            ) : null}
            <div className="rte-toolbar" role="toolbar" aria-label={t("note.formatting")}>
                {buttons.map((button) =>
                    button === "divider" ? (
                        <span key={`d-${Math.random()}`} className="rte-divider" aria-hidden="true" />
                    ) : (
                        <button
                            key={button.key}
                            type="button"
                            className="rte-button"
                            title={t(button.labelKey)}
                            aria-label={t(button.labelKey)}
                            // Prevent the editor from losing its selection.
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => button.run(api)}
                        >
                            <button.icon size={14} strokeWidth={1.9} aria-hidden="true" />
                        </button>
                    )
                )}
            </div>
            <div
                ref={editorRef}
                className="rte-content note-editor-content"
                role="textbox"
                aria-multiline="true"
                aria-label={ariaLabel}
                data-placeholder={placeholder}
                contentEditable
                suppressContentEditableWarning
                spellCheck
                onInput={emit}
                onBlur={emit}
                onPaste={(event) => {
                    // Force plain text so pasted pages cannot smuggle markup in.
                    event.preventDefault();
                    const text = event.clipboardData.getData("text/plain");
                    document.execCommand("insertText", false, text);
                    emit();
                }}
            />
        </div>
    );
}

