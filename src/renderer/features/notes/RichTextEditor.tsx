import { useCallback, useEffect, useRef, useState } from "react";
import {
    AlignCenter,
    AlignLeft,
    AlignRight,
    Bold,
    ImagePlus,
    Italic,
    Link2,
    List,
    ListOrdered,
    Minus,
    Plus,
    Quote,
    Redo2,
    Strikethrough,
    Trash2,
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

/** Images above this size are rejected instead of bloating the local database. */
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

/** Steps used by the resize buttons, in percent of the editor width. */
const WIDTH_STEPS = [25, 40, 55, 70, 85, 100];

type ImageAlign = "left" | "center" | "right";

/**
 * ─── NEW: images ───
 * Alignment is written as inline style rather than an attribute because the
 * shared sanitizer allowlists exactly `display`, `margin` and `width` on images.
 * That keeps one source of truth: what the editor writes is what survives a save.
 *
 * ─── OLD CODE (kept for reference) ───
 * All three alignments used `display:block` and differed only in `margin`.
 * A block image always occupies its own full-width row, so `margin:0 auto` was
 * the only one that looked right; left/right just pinned a full-width block to
 * the edge and never let text wrap next to it.
 *
 * ─── NEW: left/right float, centre stays a centred block ───
 * - left / right use `float`, so the text flows beside the image like a
 *   magazine layout and the image genuinely sits on that side.
 * - centre uses a block with automatic side margins.
 * The sanitizer keeps `float` alongside `display`, `margin` and `width`.
 */
function alignStyle(align: ImageAlign): string {
    switch (align) {
        case "left":
            return "float:left;margin:0 16px 8px 0";
        case "right":
            return "float:right;margin:0 0 8px 16px";
        default:
            return "clear:both;display:block;margin:8px auto";
    }
}

function applyImageStyle(image: HTMLImageElement, align: ImageAlign, width?: number) {
    image.setAttribute("style", width ? `${alignStyle(align)};width:${width}%` : alignStyle(align));
    image.setAttribute("loading", "lazy");
}

function readImageAlign(image: HTMLImageElement): ImageAlign {
    const style = image.getAttribute("style") ?? "";
    if (/float\s*:\s*left/i.test(style)) return "left";
    if (/float\s*:\s*right/i.test(style)) return "right";
    return "center";
}

function readImageWidth(image: HTMLImageElement): number {
    const match = /width\s*:\s*(\d+(?:\.\d+)?)%/i.exec(image.getAttribute("style") ?? "");
    return match ? Number(match[1]) : 100;
}

function moveStep(current: number, direction: 1 | -1): number {
    if (direction === 1) return WIDTH_STEPS.find((step) => step > current) ?? WIDTH_STEPS[WIDTH_STEPS.length - 1];
    return [...WIDTH_STEPS].reverse().find((step) => step < current) ?? WIDTH_STEPS[0];
}

function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(reader.error ?? new Error("read failed"));
        reader.readAsDataURL(file);
    });
}

/**
 * A small, dependency-free rich text editor.
 *
 * `document.execCommand` is formally deprecated but remains the only way to get
 * reliable in-place editing without shipping a framework, and every Chromium
 * version Electron ships still implements it correctly. The alternative
 * (CKEditor/ProseMirror) adds about a megabyte to an offline-first desktop app.
 *
 * ─── NEW: images in the body ───
 * Images are pasted, dropped or picked from disk, stored inline as `data:`
 * URLs so the note stays self-contained and offline, and can be resized and
 * aligned from a contextual toolbar that appears when one is selected.
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
    const fileInputRef = useRef<HTMLInputElement>(null);
    // ─── NEW: the whole editor card (toolbar + body). Used to decide whether a
    // mousedown is "inside" when dismissing the image selection. ───
    const rootRef = useRef<HTMLDivElement>(null);
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
    // ─── NEW: which image is selected, so the image toolbar can act on it. ───
    const [selectedImage, setSelectedImage] = useState<HTMLImageElement | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

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

    // ─── NEW: a notice (image too large, unreadable file) clears itself so the
    // toolbar does not keep showing a stale message. ───
    useEffect(() => {
        if (!notice) return;
        const timer = window.setTimeout(() => setNotice(null), 4000);
        return () => window.clearTimeout(timer);
    }, [notice]);

    // ─── NEW: clicking outside the editor drops the image selection. ───
    useEffect(() => {
        const handlePointerDown = (event: MouseEvent) => {
            const target = event.target;
            // ─── OLD CODE (kept for reference) ───
            // if (editorRef.current && event.target instanceof Node && editorRef.current.contains(event.target)) return;
            // setSelectedImage(null);
            //
            // That only exempted the editable body. The image controls live in
            // the toolbar, which sits *outside* `.rte-content`, so pressing
            // "smaller", "larger", "align" or "delete" cleared `selectedImage`
            // on mousedown — before the click handler could use it. The style
            // change often still applied (it reads the DOM node), but the
            // toolbar vanished and delete had nothing left to act on, which is
            // exactly the "nothing happens and the option closes" symptom.
            //
            // ─── NEW: treat the whole editor card (toolbar included) as inside,
            // and also ignore clicks on a portalled popover, so only a real
            // click elsewhere dismisses the selection. ───
            if (target instanceof Node) {
                if (rootRef.current?.contains(target)) return;
                // The image menu can be rendered in a portal outside the card.
                if (target instanceof Element && target.closest(".popover")) return;
            }
            setSelectedImage(null);
        };
        document.addEventListener("mousedown", handlePointerDown);
        return () => document.removeEventListener("mousedown", handlePointerDown);
    }, []);

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

    /**
     * ─── NEW ───
     * Insert an image at the caret.
     *
     * ─── OLD CODE (kept for reference) ───
     * const html = `<img src="${src}" alt="${alt}" style="${alignStyle("center")};width:100%" loading="lazy"><p><br></p>`;
     * document.execCommand("insertHTML", false, html);
     *
     * `execCommand("insertHTML")` re-parses the string with the editing engine
     * and normalises the inline style: `display` and the `margin` shorthand
     * were dropped, leaving only `margin-top` / `margin-bottom`. The image
     * therefore rendered inline and could not be aligned at all.
     *
     * ─── NEW: build the element and insert it as a node ───
     * A real DOM node keeps the style attribute exactly as written, and the
     * insertion point is the live selection, so typing continues after it.
     */
    const insertImage = useCallback(
        (src: string, alt = "") => {
            const node = editorRef.current;
            if (!node) return;
            setSelectedImage(null);
            if (document.activeElement !== node) node.focus();

            const selection = window.getSelection();
            let range: Range;
            if (selection && selection.rangeCount > 0 && node.contains(selection.getRangeAt(0).startContainer)) {
                range = selection.getRangeAt(0);
            } else {
                // The editor was never focused: append at the end of the body.
                range = document.createRange();
                range.selectNodeContents(node);
                range.collapse(false);
            }
            range.deleteContents();

            const image = document.createElement("img");
            image.src = src;
            image.alt = alt;
            image.setAttribute("loading", "lazy");
            applyImageStyle(image, "center", 100);

            // An empty paragraph after the image gives the caret somewhere to go,
            // matching what the old `insertHTML` produced.
            const spacer = document.createElement("p");
            spacer.appendChild(document.createElement("br"));

            const fragment = document.createDocumentFragment();
            fragment.appendChild(image);
            fragment.appendChild(spacer);
            range.insertNode(fragment);

            // Put the caret inside the trailing paragraph.
            const after = document.createRange();
            after.setStart(spacer, 0);
            after.collapse(true);
            selection?.removeAllRanges();
            selection?.addRange(after);

            emit();
        },
        [emit]
    );

    const insertImagesFromFiles = useCallback(
        async (files: File[]) => {
            const images = files.filter((file) => file.type.startsWith("image/"));
            if (images.length === 0) return;
            for (const file of images) {
                if (file.size > MAX_IMAGE_BYTES) {
                    setNotice(t("note.imageTooLarge"));
                    continue;
                }
                try {
                    const dataUrl = await readFileAsDataUrl(file);
                    if (dataUrl) insertImage(dataUrl, file.name.replace(/\.[^.]+$/, ""));
                } catch {
                    setNotice(t("note.imageFailed"));
                }
            }
        },
        [insertImage, t]
    );

    function selectImage(image: HTMLImageElement) {
        setSelectedImage(image);
        // Give the image a width when it came from somewhere else, so the resize
        // buttons have a starting point.
        if (!/width\s*:/i.test(image.getAttribute("style") ?? "")) {
            applyImageStyle(image, readImageAlign(image), 100);
            emit();
        }
    }

    function updateSelectedImage(update: (image: HTMLImageElement) => void) {
        if (!selectedImage) return;
        update(selectedImage);
        emit();
    }

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
        // ─── NEW: image insertion sits next to the other formatting tools. ───
        {
            key: "image",
            labelKey: "note.insertImage",
            icon: ImagePlus,
            run: () => {
                rememberSelection();
                fileInputRef.current?.click();
            }
        },
        "divider",
        { key: "undo", labelKey: "note.undo", icon: Undo2, run: (a) => a.run("undo") },
        { key: "redo", labelKey: "note.redo", icon: Redo2, run: (a) => a.run("redo") }
    ];

    return (
        <div className="rte" ref={rootRef}>
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
                {/* ─── NEW: contextual image controls; only shown while an image is selected. ─── */}
                {selectedImage ? (
                    <>
                        <span className="rte-divider" aria-hidden="true" />
                        <button
                            type="button"
                            className="rte-button"
                            title={t("note.imageSmaller")}
                            aria-label={t("note.imageSmaller")}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() =>
                                updateSelectedImage((image) =>
                                    applyImageStyle(image, readImageAlign(image), moveStep(readImageWidth(image), -1))
                                )
                            }
                        >
                            <Minus size={14} strokeWidth={2.2} aria-hidden="true" />
                        </button>
                        <button
                            type="button"
                            className="rte-button"
                            title={t("note.imageLarger")}
                            aria-label={t("note.imageLarger")}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() =>
                                updateSelectedImage((image) =>
                                    applyImageStyle(image, readImageAlign(image), moveStep(readImageWidth(image), 1))
                                )
                            }
                        >
                            <Plus size={14} strokeWidth={2.2} aria-hidden="true" />
                        </button>
                        <span className="rte-divider" aria-hidden="true" />
                        <button
                            type="button"
                            className="rte-button"
                            title={t("note.alignLeft")}
                            aria-label={t("note.alignLeft")}
                            aria-pressed={readImageAlign(selectedImage) === "left"}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() =>
                                updateSelectedImage((image) => applyImageStyle(image, "left", readImageWidth(image)))
                            }
                        >
                            <AlignLeft size={14} strokeWidth={1.9} aria-hidden="true" />
                        </button>
                        <button
                            type="button"
                            className="rte-button"
                            title={t("note.alignCenter")}
                            aria-label={t("note.alignCenter")}
                            aria-pressed={readImageAlign(selectedImage) === "center"}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() =>
                                updateSelectedImage((image) => applyImageStyle(image, "center", readImageWidth(image)))
                            }
                        >
                            <AlignCenter size={14} strokeWidth={1.9} aria-hidden="true" />
                        </button>
                        <button
                            type="button"
                            className="rte-button"
                            title={t("note.alignRight")}
                            aria-label={t("note.alignRight")}
                            aria-pressed={readImageAlign(selectedImage) === "right"}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() =>
                                updateSelectedImage((image) => applyImageStyle(image, "right", readImageWidth(image)))
                            }
                        >
                            <AlignRight size={14} strokeWidth={1.9} aria-hidden="true" />
                        </button>
                        <button
                            type="button"
                            className="rte-button rte-button-danger"
                            title={t("note.imageDelete")}
                            aria-label={t("note.imageDelete")}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                                updateSelectedImage((image) => image.remove());
                                setSelectedImage(null);
                            }}
                        >
                            <Trash2 size={14} strokeWidth={1.9} aria-hidden="true" />
                        </button>
                    </>
                ) : null}
            </div>
            {notice ? (
                <p className="rte-notice" role="status">
                    {notice}
                </p>
            ) : null}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(event) => {
                    const files = Array.from(event.target.files ?? []);
                    event.target.value = "";
                    editorRef.current?.focus();
                    restoreSelection();
                    void insertImagesFromFiles(files);
                }}
            />
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
                onClick={(event) => {
                    // ─── NEW: clicking an image selects it instead of dropping a
                    // caret next to it, which is what makes resize/align usable. ───
                    if (event.target instanceof HTMLImageElement) {
                        event.preventDefault();
                        editorRef.current?.querySelectorAll("img.is-selected").forEach((node) => {
                            if (node !== event.target) node.classList.remove("is-selected");
                        });
                        event.target.classList.add("is-selected");
                        selectImage(event.target);
                        return;
                    }
                    editorRef.current?.querySelectorAll("img.is-selected").forEach((node) => {
                        node.classList.remove("is-selected");
                    });
                    setSelectedImage(null);
                }}
                onDragOver={(event) => {
                    // ─── NEW: dropping an image file inserts it where it lands. ───
                    if (Array.from(event.dataTransfer.items).some((item) => item.kind === "file")) {
                        event.preventDefault();
                    }
                }}
                onDrop={(event) => {
                    const files = Array.from(event.dataTransfer.files ?? []);
                    if (files.length === 0) return;
                    event.preventDefault();
                    editorRef.current?.focus();
                    const range = document.caretRangeFromPoint?.(event.clientX, event.clientY);
                    if (range) {
                        const selection = window.getSelection();
                        selection?.removeAllRanges();
                        selection?.addRange(range);
                    }
                    void insertImagesFromFiles(files);
                }}
                onPaste={(event) => {
                    // ─── NEW: an image on the clipboard is inserted; everything
                    // else is still forced to plain text so pasted pages cannot
                    // smuggle markup in. ───
                    const images = Array.from(event.clipboardData.files ?? []).filter((file) =>
                        file.type.startsWith("image/")
                    );
                    if (images.length > 0) {
                        event.preventDefault();
                        void insertImagesFromFiles(images);
                        return;
                    }
                    event.preventDefault();
                    const text = event.clipboardData.getData("text/plain");
                    document.execCommand("insertText", false, text);
                    emit();
                }}
            />
        </div>
    );
}

// ─── OLD CODE (kept for reference) ────────────────────────────────────────────
// The pre-image version of this component, verbatim. The new version above is a
// superset: same text toolbar, same link field, no changed behaviour for text.
// Kept so the image feature can be reverted by restoring these pieces.
//
// import { useCallback, useEffect, useRef, useState } from "react";
// import {
//     Bold,
//     Italic,
//     Link2,
//     List,
//     ListOrdered,
//     Quote,
//     Redo2,
//     Strikethrough,
//     Underline,
//     Undo2
// } from "lucide-react";
// import { useI18n } from "@/i18n";
// import type { TranslationKey } from "@/i18n/translations";
// import { toEditorHtml } from "@/lib/noteContent";
//
// export type EditorCommand =
//     | "bold"
//     | "italic"
//     | "underline"
//     | "strikeThrough"
//     | "insertUnorderedList"
//     | "insertOrderedList"
//     | "undo"
//     | "redo";
//
// interface RichTextApi {
//     run(command: EditorCommand): void;
//     /** Blocks are applied to the caret's paragraph (or the selection). */
//     block(tag: "blockquote" | "p"): void;
//     link(url: string): void;
//     getSelectionText(): string;
// }
//
// /** Legacy shape kept out of the public surface. */
// type LegacyExec = (command: string, arg?: string) => void;
//
// interface ToolbarButton {
//     key: string;
//     labelKey: TranslationKey;
//     icon: typeof Bold;
//     run: (api: RichTextApi) => void;
// }
//
// export function RichTextEditor({
//     value,
//     onChange,
//     placeholder,
//     ariaLabel
// }: {
//     value: string;
//     onChange: (html: string) => void;
//     placeholder: string;
//     ariaLabel: string;
// }) {
//     const { t } = useI18n();
//     const editorRef = useRef<HTMLDivElement>(null);
//     const lastValueRef = useRef<string | null>(null);
//     const [linkOpen, setLinkOpen] = useState(false);
//     const [linkUrl, setLinkUrl] = useState("https://");
//     const savedRangeRef = useRef<Range | null>(null);
//
//     function rememberSelection() {
//         const selection = window.getSelection();
//         if (selection && selection.rangeCount > 0) {
//             savedRangeRef.current = selection.getRangeAt(0).cloneRange();
//         }
//     }
//
//     function restoreSelection() {
//         const selection = window.getSelection();
//         if (!selection || !savedRangeRef.current) return;
//         selection.removeAllRanges();
//         selection.addRange(savedRangeRef.current);
//     }
//
//     function commitLink() {
//         const url = linkUrl.trim();
//         setLinkOpen(false);
//         if (!/^https?:\/\//i.test(url)) return;
//         editorRef.current?.focus();
//         restoreSelection();
//         document.execCommand("createLink", false, url);
//         editorRef.current?.querySelectorAll("a[href]").forEach((anchor) => {
//             anchor.setAttribute("target", "_blank");
//             anchor.setAttribute("rel", "noreferrer noopener");
//         });
//         emit();
//     }
//
//     useEffect(() => {
//         const node = editorRef.current;
//         if (!node) return;
//         if (value === lastValueRef.current) return;
//         const next = toEditorHtml(value);
//         if (node.innerHTML !== next) node.innerHTML = next;
//         lastValueRef.current = value;
//     }, [value]);
//
//     const emit = useCallback(() => {
//         const html = editorRef.current?.innerHTML ?? "";
//         lastValueRef.current = html;
//         onChange(html);
//     }, [onChange]);
//
//     const exec: LegacyExec = useCallback(
//         (command: string, arg?: string) => {
//             const node = editorRef.current;
//             if (!node) return;
//             node.focus();
//             document.execCommand(command, false, arg);
//             emit();
//         },
//         [emit]
//     );
//
//     const api: RichTextApi = {
//         run: (command) => exec(command),
//         block: (tag) => exec("formatBlock", tag),
//         link: (url) => {
//             exec("createLink", url);
//             editorRef.current?.querySelectorAll("a[href]").forEach((anchor) => {
//                 anchor.setAttribute("target", "_blank");
//                 anchor.setAttribute("rel", "noreferrer noopener");
//             });
//         },
//         getSelectionText: () => window.getSelection()?.toString() ?? ""
//     };
//
//     const buttons: (ToolbarButton | "divider")[] = [
//         { key: "bold", labelKey: "note.bold", icon: Bold, run: (a) => a.run("bold") },
//         { key: "italic", labelKey: "note.italic", icon: Italic, run: (a) => a.run("italic") },
//         { key: "underline", labelKey: "note.underline", icon: Underline, run: (a) => a.run("underline") },
//         { key: "strike", labelKey: "note.strike", icon: Strikethrough, run: (a) => a.run("strikeThrough") },
//         "divider",
//         { key: "ul", labelKey: "note.bulletedList", icon: List, run: (a) => a.run("insertUnorderedList") },
//         { key: "ol", labelKey: "note.numberedList", icon: ListOrdered, run: (a) => a.run("insertOrderedList") },
//         { key: "quote", labelKey: "note.quote", icon: Quote, run: (a) => a.block("blockquote") },
//         "divider",
//         {
//             key: "link",
//             labelKey: "note.link",
//             icon: Link2,
//             run: (a) => {
//                 if (!a.getSelectionText()) return;
//                 rememberSelection();
//                 setLinkOpen(true);
//             }
//         },
//         "divider",
//         { key: "undo", labelKey: "note.undo", icon: Undo2, run: (a) => a.run("undo") },
//         { key: "redo", labelKey: "note.redo", icon: Redo2, run: (a) => a.run("redo") }
//     ];
//
//     // …the JSX was identical to the current render except that it had no
//     // image toolbar, no hidden file input and no image select/drop handlers.
//     // The paste handler forced plain text:
//     //     onPaste={(event) => {
//     //         event.preventDefault();
//     //         const text = event.clipboardData.getData("text/plain");
//     //         document.execCommand("insertText", false, text);
//     //         emit();
//     //     }}
// }
