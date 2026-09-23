import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import { FontSize, TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { Highlight } from "@tiptap/extension-highlight";
import {
  Bold, Italic, Underline as UnderlineIcon, Heading1, Heading2, Heading3, Heading4, Heading5, Heading6,
  AlignLeft, AlignCenter, AlignRight, AlignJustify, List, ListOrdered, Quote, Link as LinkIcon,
  Image as ImageIcon, Table as TableIcon, Minus, Code2, Maximize2, RemoveFormatting, Strikethrough,
  ChevronDown, Palette, Highlighter, Eye, Pencil, FileText, Trash2, Pilcrow, Undo2, Redo2, Loader2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { RichText } from "@/components/detail/RichText";
import { InternalLinkPicker } from "@/components/admin/InternalLinkPicker";
import { ImageUploadField } from "@/components/admin/ImageUploadField";
import { ResizableImage, normalizeImageAlignment, normalizeImageWidth, type ImageAlignment } from "@/components/admin/ResizableImage";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { backendClient } from "@/integrations/backend/client";
import { optimizeImageFile } from "@/lib/imageOptimizer";
import { toast } from "sonner";

interface RichTextEditorProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  bare?: boolean;
  autoGrow?: boolean;
}

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
type EditorLinkSelection = { from: number; to: number };

export function applyBlockHeading(editor: Editor, level: HeadingLevel) {
  return editor.chain().focus().toggleHeading({ level }).run();
}

const inlineHeadingSizes: Record<HeadingLevel, string> = {
  1: "2rem",
  2: "1.5rem",
  3: "1.25rem",
  4: "1.125rem",
  5: "1rem",
  6: "0.875rem",
};

const safeInlineImageTypes = new Set(["image/avif", "image/gif", "image/jpeg", "image/png", "image/webp"]);

async function uploadInlineImage(rawFile: File): Promise<string> {
  if (!safeInlineImageTypes.has(rawFile.type)) throw new Error("Use a PNG, JPG, WebP, GIF, or AVIF image");
  const file = rawFile.type === "image/gif" ? rawFile : await optimizeImageFile(rawFile);
  if (file.size > 8 * 1024 * 1024) throw new Error("Images in content cannot exceed 8 MB");
  const ext = file.name.split(".").pop() || "webp";
  const path = `editor/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await backendClient.storage.from("admin-uploads").upload(path, file, {
    cacheControl: "31536000",
    upsert: false,
    contentType: file.type,
  });
  if (error) throw error;
  return backendClient.storage.from("admin-uploads").getPublicUrl(path).data.publicUrl;
}

export function applySelectionAwareHeading(editor: Editor, level: HeadingLevel) {
  const { selection } = editor.state;
  const { $from, $to, empty } = selection;
  const isSingleTextBlock = $from.sameParent($to) && $from.parent.isTextblock;
  const isWholeTextBlock = isSingleTextBlock
    && $from.parentOffset === 0
    && $to.parentOffset === $from.parent.content.size;

  if (empty || !isSingleTextBlock || isWholeTextBlock) {
    return applyBlockHeading(editor, level);
  }

  return editor.chain().focus().setFontSize(inlineHeadingSizes[level]).setBold().run();
}

export function normalizeEditorLinkUrl(value: string) {
  const href = String(value || "").trim();
  if (!href || href === "https://") return "";
  if (/^(?:https?:|mailto:|tel:|\/|#|\.\.?\/)/i.test(href)) return href;
  if (/^[a-z0-9.-]+\.[a-z]{2,}(?:[/?#].*)?$/i.test(href)) return `https://${href}`;
  return "";
}

export function applyEditorLink(editor: Editor, value: string, displayText: string, selection?: EditorLinkSelection | null) {
  const docEnd = editor.state.doc.content.size;
  if (selection && selection.from >= 0 && selection.to <= docEnd && selection.from <= selection.to) {
    editor.commands.setTextSelection(selection);
  }
  const href = normalizeEditorLinkUrl(value);
  if (!href) return editor.chain().focus().extendMarkRange("link").unsetLink().run();
  if (editor.state.selection.empty) {
    const text = displayText.trim();
    if (!text) return false;
    return editor.chain().focus().insertContent({
      type: "text",
      text,
      marks: [{ type: "link", attrs: { href } }],
    }).run();
  }
  return editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
}

/**
 * TipTap-based WYSIWYG editor. Outputs HTML. Renders bold as bold, headings as headings,
 * tables as tables in real-time. Toolbar mirrors the requested layout.
 */
export function RichTextEditor({ label, value, onChange, rows = 6, placeholder, bare = false, autoGrow = false }: RichTextEditorProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [inlineUploads, setInlineUploads] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const lastEmittedHtml = useRef(value || "");

  const insertImageFiles = async (files: File[], position?: number) => {
    const accepted = files.filter((file) => safeInlineImageTypes.has(file.type));
    if (!accepted.length) {
      toast.error("Drop or paste a PNG, JPG, WebP, GIF, or AVIF image");
      return;
    }
    setInlineUploads((count) => count + accepted.length);
    let insertAt = position;
    try {
      for (const file of accepted) {
        const src = await uploadInlineImage(file);
        const currentEditor = editorRef.current;
        if (!currentEditor) return;
        const content = {
          type: "image",
          attrs: {
            src,
            alt: file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "),
            width: 100,
            align: "center",
          },
        };
        if (typeof insertAt === "number") {
          const positionInDocument = Math.min(Math.max(insertAt, 0), currentEditor.state.doc.content.size);
          currentEditor.chain().focus().insertContentAt(positionInDocument, content).run();
          insertAt = positionInDocument + 1;
        } else {
          currentEditor.chain().focus().insertContent(content).run();
        }
      }
      toast.success(`${accepted.length} image${accepted.length === 1 ? "" : "s"} uploaded`);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Image upload failed");
    } finally {
      setInlineUploads((count) => Math.max(0, count - accepted.length));
    }
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3, 4, 5, 6] }, link: false, underline: false }),
      Underline,
      TextStyle,
      FontSize,
      Color,
      Highlight.configure({ multicolor: true }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-primary underline" } }),
      ResizableImage.configure({ HTMLAttributes: { class: "rounded-lg max-w-full my-2" } }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder: placeholder || "Start typing…" }),
      Table.configure({ resizable: true, HTMLAttributes: { class: "border-collapse w-full my-2" } }),
      TableRow,
      TableHeader.configure({ HTMLAttributes: { class: "border border-border bg-muted/50 p-2 text-left font-semibold" } }),
      TableCell.configure({ HTMLAttributes: { class: "border border-border p-2" } }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none px-3 py-2 min-h-[120px] !select-text cursor-text",
        "data-copy-allowed": "true",
        role: "textbox",
        "aria-multiline": "true",
      },
      handlePaste: (view, event) => {
        const files = Array.from(event.clipboardData?.files || []);
        if (!files.some((file) => safeInlineImageTypes.has(file.type))) return false;
        event.preventDefault();
        void insertImageFiles(files, view.state.selection.from);
        return true;
      },
      handleDrop: (view, event, _slice, moved) => {
        if (moved) return false;
        const files = Array.from(event.dataTransfer?.files || []);
        if (!files.some((file) => safeInlineImageTypes.has(file.type))) return false;
        event.preventDefault();
        const position = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        void insertImageFiles(files, position);
        return true;
      },
    },
    onCreate: ({ editor }) => { editorRef.current = editor; },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      lastEmittedHtml.current = html;
      onChange(html);
    },
  });

  useEffect(() => {
    editorRef.current = editor;
    return () => { if (editorRef.current === editor) editorRef.current = null; };
  }, [editor]);

  // Sync a genuinely external record change without resetting the writer's
  // selection when the parent echoes the HTML emitted by this editor.
  useEffect(() => {
    if (!editor) return;
    const nextValue = value || "";
    if (nextValue === lastEmittedHtml.current) return;
    if (nextValue !== editor.getHTML()) editor.commands.setContent(nextValue, { emitUpdate: false });
    lastEmittedHtml.current = nextValue;
  }, [value, editor]);

  useEffect(() => {
    if (!fullscreen) return;
    const exitFullscreen = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", exitFullscreen);
    return () => window.removeEventListener("keydown", exitFullscreen);
  }, [fullscreen]);

  if (!editor) return null;

  return (
    <div ref={wrapperRef} className={fullscreen ? "fixed inset-0 z-[100] bg-background p-4 flex flex-col" : ""}>
      {label && !bare && <label className="text-xs font-medium text-muted-foreground">{label}</label>}
      <div className={`mt-1 overflow-hidden rounded-lg border border-border bg-card focus-within:ring-2 focus-within:ring-ring/40 ${fullscreen ? "flex-1 flex flex-col" : ""}`}>
        <Toolbar editor={editor} fullscreen={fullscreen} setFullscreen={setFullscreen} previewMode={previewMode} setPreviewMode={setPreviewMode} />
        <div
          className={fullscreen ? "flex-1 overflow-y-auto" : autoGrow ? "min-h-[320px]" : "overflow-y-auto"}
          style={!fullscreen && !autoGrow ? { maxHeight: `${Math.max(rows, 4) * 32 + 60}px` } : undefined}
        >
          {previewMode ? (
            <div className="px-4 py-3 bg-background">
              <RichText html={value} />
              {!value?.trim() && <p className="text-xs text-muted-foreground italic">Nothing to preview yet.</p>}
            </div>
          ) : (
            <div className="relative !select-text" data-copy-allowed="true">
              <EditorContent editor={editor} />
              {inlineUploads > 0 && (
                <div className="absolute right-3 top-3 flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium shadow-sm">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  Uploading {inlineUploads} image{inlineUploads === 1 ? "" : "s"}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Toolbar({ editor, fullscreen, setFullscreen, previewMode, setPreviewMode }: { editor: Editor; fullscreen: boolean; setFullscreen: (v: boolean) => void; previewMode: boolean; setPreviewMode: (v: boolean) => void }) {
  const [tableOpen, setTableOpen] = useState(false);
  const [docDialog, setDocDialog] = useState(false);
  const [docTitle, setDocTitle] = useState("");
  const [docImages, setDocImages] = useState<string[]>([]);
  const [docUploading, setDocUploading] = useState(false);
  const [linkDialog, setLinkDialog] = useState(false);
  const [imageDialog, setImageDialog] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const [imgUrl, setImgUrl] = useState("");
  const [imgAlt, setImgAlt] = useState("");
  const [imgWidth, setImgWidth] = useState(100);
  const [imgAlign, setImgAlign] = useState<ImageAlignment>("center");
  const [editingImage, setEditingImage] = useState(false);
  const [, setEditorVersion] = useState(0);
  const [internalPickerOpen, setInternalPickerOpen] = useState(false);
  const linkSelectionRef = useRef<EditorLinkSelection | null>(null);

  useEffect(() => {
    const refresh = () => setEditorVersion((version) => version + 1);
    editor.on("selectionUpdate", refresh);
    editor.on("transaction", refresh);
    return () => {
      editor.off("selectionUpdate", refresh);
      editor.off("transaction", refresh);
    };
  }, [editor]);

  const Btn = ({ icon: Icon, title, onClick, active }: any) => (
    <button
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded transition-colors ${active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  );

  const HBtn = ({ level, Icon }: any) => (
    <Btn
      icon={Icon}
      title={`Heading ${level}: selected text, or the current paragraph when no text is selected`}
      active={editor.isActive("heading", { level })}
      onClick={() => applySelectionAwareHeading(editor, level)}
    />
  );

  const openLink = () => {
    const previous = editor.getAttributes("link").href || "";
    const { from, to, empty } = editor.state.selection;
    linkSelectionRef.current = { from, to };
    const selectedText = empty ? "" : editor.state.doc.textBetween(from, to, " ");
    setLinkUrl(previous || "https://");
    setLinkText(selectedText);
    setLinkDialog(true);
  };

  const applyLink = () => {
    applyEditorLink(editor, linkUrl, linkText, linkSelectionRef.current);
    linkSelectionRef.current = null;
    setLinkDialog(false);
  };

  const openImage = () => {
    setImgUrl("");
    setImgAlt("");
    setImgWidth(100);
    setImgAlign("center");
    setEditingImage(false);
    setImageDialog(true);
  };
  const openImageEditor = () => {
    const attributes = editor.getAttributes("image");
    setImgUrl(String(attributes.src || ""));
    setImgAlt(String(attributes.alt || ""));
    setImgWidth(normalizeImageWidth(attributes.width));
    setImgAlign(normalizeImageAlignment(attributes.align));
    setEditingImage(true);
    setImageDialog(true);
  };
  const applyImage = () => {
    if (!imgUrl) return;
    const attributes = { src: imgUrl, alt: imgAlt, width: normalizeImageWidth(imgWidth), align: normalizeImageAlignment(imgAlign) };
    if (editingImage && editor.isActive("image")) editor.chain().focus().updateAttributes("image", attributes).run();
    else editor.chain().focus().insertContent({ type: "image", attrs: attributes }).run();
    setImageDialog(false);
  };

  const openDoc = () => { setDocTitle(""); setDocImages([]); setDocDialog(true); };
  const handleDocUpload = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setDocUploading(true);
    try {
      const { backendClient } = await import("@/integrations/backend/client");
      const { optimizeImageFile } = await import("@/lib/imageOptimizer");
      const urls: string[] = [];
      for (const raw of Array.from(files)) {
        const file = await optimizeImageFile(raw);
        const ext = file.name.split(".").pop() || "webp";
        const path = `editor/doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await backendClient.storage.from("admin-uploads").upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
        if (error) throw error;
        const { data: pub } = backendClient.storage.from("admin-uploads").getPublicUrl(path);
        urls.push(pub.publicUrl);
      }
      setDocImages((prev) => [...prev, ...urls]);
    } catch (e: any) {
      alert(e.message || "Upload failed");
    } finally { setDocUploading(false); }
  };
  const applyDoc = () => {
    if (!docImages.length) return;
    const safeTitle = (docTitle || "").replace(/"/g, "&quot;");
    const imgs = docImages.map((u) => `<img src="${u}" alt="Document page" />`).join("");
    editor.chain().focus().insertContent(`<div class="doc-viewer" data-title="${safeTitle}">${imgs}</div><p></p>`).run();
    setDocDialog(false);
  };

  const insertTable = (rows: number, cols: number) => {
    editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
    setTableOpen(false);
  };

  return (
    <div className="sticky top-0 z-20 flex items-center gap-0.5 border-b border-border bg-background/95 px-2 py-1.5 backdrop-blur flex-wrap">
      <Btn icon={Undo2} title="Undo" onClick={() => editor.chain().focus().undo().run()} />
      <Btn icon={Redo2} title="Redo" onClick={() => editor.chain().focus().redo().run()} />
      <span className="w-px h-4 bg-border mx-1" />
      <Btn icon={Bold} title="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} />
      <Btn icon={Italic} title="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} />
      <Btn icon={UnderlineIcon} title="Underline" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} />
      <Btn icon={Strikethrough} title="Strike" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} />
      <span className="w-px h-4 bg-border mx-1" />
      <Btn icon={Pilcrow} title="Paragraph" active={editor.isActive("paragraph")} onClick={() => editor.chain().focus().setParagraph().run()} />
      <HBtn level={1} Icon={Heading1} />
      <HBtn level={2} Icon={Heading2} />
      <HBtn level={3} Icon={Heading3} />
      <HBtn level={4} Icon={Heading4} />
      <HBtn level={5} Icon={Heading5} />
      <HBtn level={6} Icon={Heading6} />
      <span className="w-px h-4 bg-border mx-1" />
      <Btn icon={AlignLeft} title="Align left" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()} />
      <Btn icon={AlignCenter} title="Align center" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()} />
      <Btn icon={AlignRight} title="Align right" active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()} />
      <Btn icon={AlignJustify} title="Justify" active={editor.isActive({ textAlign: "justify" })} onClick={() => editor.chain().focus().setTextAlign("justify").run()} />
      <span className="w-px h-4 bg-border mx-1" />
      <Btn icon={ListOrdered} title="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
      <Btn icon={List} title="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} />
      <span className="w-px h-4 bg-border mx-1" />
      <ColorPicker editor={editor} />
      <HighlightPicker editor={editor} />
      <span className="w-px h-4 bg-border mx-1" />
      <Btn icon={RemoveFormatting} title="Clear formatting" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} />
      <Btn icon={Quote} title="Blockquote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} />
      <Btn icon={LinkIcon} title="Insert / edit link" active={editor.isActive("link")} onClick={openLink} />
      <Btn icon={ImageIcon} title="Insert image" onClick={openImage} />
      <Btn icon={FileText} title="Insert document viewer (multi-page images)" onClick={openDoc} />
      <span className="w-px h-4 bg-border mx-1" />
      <div className="relative">
        <button type="button" onClick={() => setTableOpen(o => !o)} className="p-1.5 rounded text-muted-foreground hover:bg-muted hover:text-foreground flex items-center" title="Table">
          <TableIcon className="w-3.5 h-3.5" />
          <ChevronDown className="w-3 h-3" />
        </button>
        {tableOpen && (
          <div className="absolute right-0 top-full mt-1 z-50 max-h-72 w-52 overflow-y-auto rounded-lg border border-border bg-card p-2 shadow-lg">
            <button type="button" className="w-full text-left text-xs px-2 py-1.5 hover:bg-muted rounded" onClick={() => insertTable(3, 3)}>Insert 3×3 table</button>
            <button type="button" className="w-full text-left text-xs px-2 py-1.5 hover:bg-muted rounded" onClick={() => insertTable(2, 4)}>Insert 2×4 table</button>
            <button type="button" className="w-full text-left text-xs px-2 py-1.5 hover:bg-muted rounded" onClick={() => insertTable(5, 5)}>Insert 5×5 table</button>
            <div className="border-t border-border my-1" />
            <button type="button" disabled={!editor.can().addRowAfter()} className="w-full text-left text-xs px-2 py-1.5 hover:bg-muted rounded disabled:opacity-40" onClick={() => editor.chain().focus().addRowAfter().run()}>Add row</button>
            <button type="button" disabled={!editor.can().addColumnAfter()} className="w-full text-left text-xs px-2 py-1.5 hover:bg-muted rounded disabled:opacity-40" onClick={() => editor.chain().focus().addColumnAfter().run()}>Add column</button>
            <button type="button" disabled={!editor.can().deleteRow()} className="w-full text-left text-xs px-2 py-1.5 hover:bg-muted rounded disabled:opacity-40" onClick={() => editor.chain().focus().deleteRow().run()}>Delete row</button>
            <button type="button" disabled={!editor.can().deleteColumn()} className="w-full text-left text-xs px-2 py-1.5 hover:bg-muted rounded disabled:opacity-40" onClick={() => editor.chain().focus().deleteColumn().run()}>Delete column</button>
            <button type="button" disabled={!editor.can().deleteTable()} className="w-full text-left text-xs px-2 py-1.5 hover:bg-muted rounded disabled:opacity-40 text-destructive" onClick={() => editor.chain().focus().deleteTable().run()}>Delete table</button>
          </div>
        )}
      </div>
      <Btn icon={Minus} title="Horizontal rule" onClick={() => editor.chain().focus().setHorizontalRule().run()} />
      <Btn icon={Code2} title="Code block" active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()} />
      <Btn icon={previewMode ? Pencil : Eye} title={previewMode ? "Back to editor" : "Preview as it appears on the site"} active={previewMode} onClick={() => setPreviewMode(!previewMode)} />
      <Btn icon={Maximize2} title={fullscreen ? "Exit fullscreen" : "Fullscreen"} active={fullscreen} onClick={() => setFullscreen(!fullscreen)} />

      {editor.isActive("image") && (
        <div className="mt-1 flex basis-full flex-wrap items-center gap-1 border-t border-border/70 pt-1.5">
          <span className="mr-1 text-[10px] font-bold uppercase text-muted-foreground">Image</span>
          <div className="flex overflow-hidden rounded-md border border-border" aria-label="Image size">
            {[35, 60, 85, 100].map((width) => (
              <button
                key={width}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => editor.chain().focus().updateAttributes("image", { width }).run()}
                className={`h-7 border-r border-border px-2 text-[11px] font-semibold last:border-r-0 ${normalizeImageWidth(editor.getAttributes("image").width) === width ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
              >
                {width}%
              </button>
            ))}
          </div>
          <div className="ml-1 flex overflow-hidden rounded-md border border-border" aria-label="Image alignment">
            {([
              ["left", AlignLeft, "Align image left"],
              ["center", AlignCenter, "Center image"],
              ["right", AlignRight, "Align image right"],
            ] as const).map(([alignment, Icon, title]) => (
              <button
                key={alignment}
                type="button"
                title={title}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => editor.chain().focus().updateAttributes("image", { align: alignment }).run()}
                className={`flex h-7 w-8 items-center justify-center border-r border-border last:border-r-0 ${normalizeImageAlignment(editor.getAttributes("image").align) === alignment ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
          <button type="button" title="Edit image link and alt text" onMouseDown={(event) => event.preventDefault()} onClick={openImageEditor} className="ml-1 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button type="button" title="Remove image" onMouseDown={(event) => event.preventDefault()} onClick={() => editor.chain().focus().deleteSelection().run()} className="flex h-7 w-7 items-center justify-center rounded-md text-destructive hover:bg-destructive/10">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Link dialog */}
      <Dialog open={linkDialog} onOpenChange={setLinkDialog}>
        <DialogContent showCloseButton={false} className="w-[calc(100vw-2rem)] max-w-md gap-3 p-5">
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="flex items-center gap-2 text-base"><LinkIcon className="w-4 h-4 text-primary" /> Insert link</DialogTitle>
            <button
              type="button"
              onClick={() => setInternalPickerOpen(true)}
              className="text-xs px-2.5 py-1 rounded-full border border-primary/40 text-primary hover:bg-primary/5"
              title="Pick a college, course, exam, career, subject, board…"
            >🔍 Link from site</button>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">URL</label>
            <input autoFocus value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://example.com or /colleges/iit-delhi" className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-sm" />
          </div>
          {editor.state.selection.empty && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Display text</label>
              <input value={linkText} onChange={e => setLinkText(e.target.value)} placeholder="Click here" className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-sm" />
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setLinkDialog(false)} className="px-3 py-1.5 rounded-lg text-sm hover:bg-muted">Cancel</button>
            <button type="button" onClick={applyLink} className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm">Insert</button>
          </div>
        </DialogContent>
      </Dialog>

      <InternalLinkPicker
        open={internalPickerOpen}
        onClose={() => setInternalPickerOpen(false)}
        onPick={(url, label) => {
          setLinkUrl(url);
          if (!linkText) setLinkText(label);
        }}
      />

      {/* Image dialog */}
      <Dialog open={imageDialog} onOpenChange={setImageDialog}>
        <DialogContent showCloseButton={false} className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg gap-4 overflow-y-auto p-5">
            <DialogTitle className="flex items-center gap-2 text-base"><ImageIcon className="w-4 h-4 text-primary" /> {editingImage ? "Edit image" : "Insert image"}</DialogTitle>
            <ImageUploadField value={imgUrl} onChange={setImgUrl} label="Image URL or upload" folder="editor" maxSizeMb={8} placeholder="Paste an image URL" />
            <div>
              <label className="text-xs font-medium text-muted-foreground">Alt text</label>
              <input value={imgAlt} onChange={e => setImgAlt(e.target.value)} placeholder="Description for SEO" className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-sm" />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between gap-3 text-xs font-medium text-muted-foreground">
                <span>Width</span>
                <span>{imgWidth}%</span>
              </div>
              <input type="range" min="20" max="100" step="1" value={imgWidth} onChange={(event) => setImgWidth(normalizeImageWidth(event.target.value))} className="w-full accent-primary" />
              <div className="mt-2 grid grid-cols-4 overflow-hidden rounded-md border border-border">
                {[35, 60, 85, 100].map((width) => (
                  <button key={width} type="button" onClick={() => setImgWidth(width)} className={`h-8 border-r border-border text-xs font-semibold last:border-r-0 ${imgWidth === width ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{width}%</button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium text-muted-foreground">Alignment</label>
              <div className="grid grid-cols-3 overflow-hidden rounded-md border border-border">
                {([
                  ["left", AlignLeft, "Left"],
                  ["center", AlignCenter, "Center"],
                  ["right", AlignRight, "Right"],
                ] as const).map(([alignment, Icon, text]) => (
                  <button key={alignment} type="button" onClick={() => setImgAlign(alignment)} className={`flex h-9 items-center justify-center gap-1.5 border-r border-border text-xs font-semibold last:border-r-0 ${imgAlign === alignment ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                    <Icon className="h-3.5 w-3.5" /> {text}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setImageDialog(false)} className="px-3 py-1.5 rounded-lg text-sm hover:bg-muted">Cancel</button>
              <button type="button" onClick={applyImage} disabled={!imgUrl} className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm disabled:opacity-40">{editingImage ? "Update" : "Insert"}</button>
            </div>
        </DialogContent>
      </Dialog>

      {/* Document viewer dialog */}
      <Dialog open={docDialog} onOpenChange={setDocDialog}>
        <DialogContent showCloseButton={false} className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg gap-3 overflow-y-auto p-5">
            <DialogTitle className="flex items-center gap-2 text-base"><FileText className="w-4 h-4 text-primary" /> Insert document viewer</DialogTitle>
            <p className="text-xs text-muted-foreground">Upload pages of a PDF, question paper or notes as images. They'll appear as a paginated viewer in the article.</p>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Title (optional)</label>
              <input value={docTitle} onChange={e => setDocTitle(e.target.value)} placeholder="e.g. CUET 2026 Biology Question Paper PDF" className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-sm" />
            </div>
            <label className="block border-2 border-dashed border-border rounded-xl p-4 text-center cursor-pointer hover:border-primary/50 transition">
              <input type="file" accept="image/*" multiple className="hidden" onChange={e => handleDocUpload(e.target.files)} />
              <ImageIcon className="w-6 h-6 mx-auto mb-1 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">{docUploading ? "Uploading…" : "Click to upload one or more pages (JPG/PNG)"}</p>
            </label>
            {docImages.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {docImages.map((u, i) => (
                  <div key={i} className="relative group border border-border rounded-lg overflow-hidden bg-muted">
                    <img src={u} alt={`Page ${i + 1}`} className="w-full h-24 object-cover" />
                    <span className="absolute top-1 left-1 bg-foreground/80 text-background text-[10px] px-1.5 py-0.5 rounded">{i + 1}</span>
                    <button type="button" onClick={() => setDocImages(prev => prev.filter((_, idx) => idx !== i))}
                      className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded opacity-0 group-hover:opacity-100 transition">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setDocDialog(false)} className="px-3 py-1.5 rounded-lg text-sm hover:bg-muted">Cancel</button>
              <button type="button" onClick={applyDoc} disabled={!docImages.length} className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm disabled:opacity-40">Insert ({docImages.length})</button>
            </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const TEXT_COLORS = ["#000000", "#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899"];
const HIGHLIGHT_COLORS = ["#fef08a", "#bbf7d0", "#bfdbfe", "#fecaca", "#e9d5ff", "#fed7aa"];

function ColorPicker({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(o => !o)} title="Text color" className="p-1.5 rounded text-muted-foreground hover:bg-muted hover:text-foreground flex items-center">
        <Palette className="w-3.5 h-3.5" /><ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-card border border-border rounded-lg shadow-lg p-2 grid grid-cols-4 gap-1 w-32">
          {TEXT_COLORS.map(c => (
            <button key={c} type="button" onClick={() => { editor.chain().focus().setColor(c).run(); setOpen(false); }} className="w-6 h-6 rounded border border-border" style={{ backgroundColor: c }} title={c} />
          ))}
          <button type="button" onClick={() => { editor.chain().focus().unsetColor().run(); setOpen(false); }} className="col-span-4 text-[10px] px-2 py-1 hover:bg-muted rounded">Clear</button>
        </div>
      )}
    </div>
  );
}

function HighlightPicker({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(o => !o)} title="Highlight" className="p-1.5 rounded text-muted-foreground hover:bg-muted hover:text-foreground flex items-center">
        <Highlighter className="w-3.5 h-3.5" /><ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-card border border-border rounded-lg shadow-lg p-2 grid grid-cols-3 gap-1 w-28">
          {HIGHLIGHT_COLORS.map(c => (
            <button key={c} type="button" onClick={() => { editor.chain().focus().toggleHighlight({ color: c }).run(); setOpen(false); }} className="w-6 h-6 rounded border border-border" style={{ backgroundColor: c }} title={c} />
          ))}
          <button type="button" onClick={() => { editor.chain().focus().unsetHighlight().run(); setOpen(false); }} className="col-span-3 text-[10px] px-2 py-1 hover:bg-muted rounded">Clear</button>
        </div>
      )}
    </div>
  );
}
