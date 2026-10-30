"use client";

/* eslint-disable @next/next/no-img-element -- editor previews of library images */
import {
  EditorContent,
  type Editor,
  mergeAttributes,
  Node,
  NodeViewWrapper,
  type ReactNodeViewProps,
  ReactNodeViewRenderer,
  useEditor,
  useEditorState,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useState } from "react";
import type { RichDoc } from "@/lib/richtext";
import { youtubeId } from "@/lib/richtext";
import { MediaDialog } from "./MediaPicker";
import { inputClass } from "./ui";

/**
 * The rich-text editor used for post bodies, project descriptions and page
 * sections. It produces the JSON document described in src/lib/richtext.ts,
 * which the site renders with its own type styles — so what is typed here
 * always looks right on the page, and no pasted formatting or HTML can leak
 * through.
 *
 * Besides text it can hold three blocks: an image from the media library
 * (with caption), a pull quote, and a YouTube / .mp4 video.
 */

/* ── Custom blocks ─────────────────────────────────────────────────── */

function FigureView({ node, updateAttributes, deleteNode, selected }: ReactNodeViewProps) {
  return (
    <NodeViewWrapper className={`my-3 rounded-md border bg-sand-50 p-3 ${selected ? "border-lime-500" : "border-sand-300"}`} data-drag-handle>
      <div className="flex gap-3">
        <img src={String(node.attrs.src ?? "")} alt="" className="h-28 w-40 shrink-0 rounded object-cover" />
        <div className="flex min-w-0 flex-1 flex-col gap-2 font-ui text-[13px]">
          <input
            className={inputClass}
            placeholder="Caption (optional)"
            value={String(node.attrs.caption ?? "")}
            onChange={(e) => updateAttributes({ caption: e.target.value })}
          />
          <input
            className={inputClass}
            placeholder="Describe the image for people who cannot see it"
            value={String(node.attrs.alt ?? "")}
            onChange={(e) => updateAttributes({ alt: e.target.value })}
          />
          <button type="button" onClick={deleteNode} className="self-start font-semibold text-red-800 hover:underline">
            Remove image
          </button>
        </div>
      </div>
    </NodeViewWrapper>
  );
}

const Figure = Node.create({
  name: "figure",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return { mediaId: { default: null }, src: { default: "" }, alt: { default: "" }, caption: { default: "" } };
  },
  parseHTML() {
    return [{ tag: "figure[data-media-id]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["figure", mergeAttributes({ "data-media-id": HTMLAttributes.mediaId })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(FigureView);
  },
});

function PullQuoteView({ node, updateAttributes, deleteNode, selected }: ReactNodeViewProps) {
  return (
    <NodeViewWrapper className={`my-3 rounded-md border-y-2 bg-white p-3 ${selected ? "border-lime-500" : "border-sand-300"}`}>
      <p className="mb-1.5 font-ui text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">Pull quote</p>
      <textarea
        className={`${inputClass} font-display text-[18px] font-semibold uppercase`}
        rows={2}
        placeholder="The quote"
        value={String(node.attrs.quote ?? "")}
        onChange={(e) => updateAttributes({ quote: e.target.value })}
      />
      <div className="mt-2 flex items-center gap-2 font-ui text-[13px]">
        <input
          className={inputClass}
          placeholder="Who said it, and their role"
          value={String(node.attrs.attribution ?? "")}
          onChange={(e) => updateAttributes({ attribution: e.target.value })}
        />
        <button type="button" onClick={deleteNode} className="shrink-0 font-semibold text-red-800 hover:underline">
          Remove
        </button>
      </div>
    </NodeViewWrapper>
  );
}

const PullQuote = Node.create({
  name: "pullQuote",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return { quote: { default: "" }, attribution: { default: "" } };
  },
  parseHTML() {
    return [{ tag: "aside[data-pull-quote]" }];
  },
  renderHTML() {
    return ["aside", { "data-pull-quote": "" }];
  },
  addNodeView() {
    return ReactNodeViewRenderer(PullQuoteView);
  },
});

type StatItem = { value: string; label: string };

/** The row of big figures inside an article ("115 students · 5 schools · $7K invested"). */
function StatStripView({ node, updateAttributes, deleteNode, selected }: ReactNodeViewProps) {
  const stats: StatItem[] = Array.isArray(node.attrs.stats) ? node.attrs.stats : [];
  const set = (next: StatItem[]) => updateAttributes({ stats: next });
  return (
    <NodeViewWrapper className={`my-3 rounded-md border-y-2 bg-white p-3 ${selected ? "border-lime-500" : "border-sand-300"}`}>
      <p className="mb-1.5 font-ui text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">Figures (up to 4)</p>
      <div className="flex flex-col gap-2 font-ui text-[13px]">
        {stats.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              className={`${inputClass} w-28`}
              placeholder="66+"
              value={s.value}
              onChange={(e) => set(stats.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
            />
            <input
              className={inputClass}
              placeholder="scholars supported"
              value={s.label}
              onChange={(e) => set(stats.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
            />
            <button type="button" onClick={() => set(stats.filter((_, j) => j !== i))} className="shrink-0 text-red-800 hover:underline">
              Remove
            </button>
          </div>
        ))}
        <div className="flex gap-3">
          {stats.length < 4 && (
            <button type="button" onClick={() => set([...stats, { value: "", label: "" }])} className="font-semibold text-forest-900 hover:underline">
              + Add a figure
            </button>
          )}
          <button type="button" onClick={deleteNode} className="ml-auto font-semibold text-red-800 hover:underline">
            Remove all figures
          </button>
        </div>
      </div>
    </NodeViewWrapper>
  );
}

const StatStrip = Node.create({
  name: "statStrip",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return { stats: { default: [] } };
  },
  parseHTML() {
    return [{ tag: "div[data-stat-strip]" }];
  },
  renderHTML() {
    return ["div", { "data-stat-strip": "" }];
  },
  addNodeView() {
    return ReactNodeViewRenderer(StatStripView);
  },
});

function VideoView({ node, deleteNode, selected }: ReactNodeViewProps) {
  const url = String(node.attrs.url ?? "");
  const id = youtubeId(url);
  return (
    <NodeViewWrapper className={`my-3 flex items-center gap-3 rounded-md border bg-forest-950 p-3 font-ui text-[13px] text-sand-100 ${selected ? "border-lime-500" : "border-transparent"}`}>
      {id ? (
        <img src={`https://i.ytimg.com/vi/${id}/mqdefault.jpg`} alt="" className="h-16 w-28 rounded object-cover" />
      ) : (
        <span className="flex h-16 w-28 items-center justify-center rounded bg-forest-800">▶</span>
      )}
      <span className="min-w-0 flex-1 truncate">Video: {url}</span>
      <button type="button" onClick={deleteNode} className="font-semibold text-lime-400 hover:underline">
        Remove
      </button>
    </NodeViewWrapper>
  );
}

const Video = Node.create({
  name: "video",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return { url: { default: "" } };
  },
  parseHTML() {
    return [{ tag: "div[data-video]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", { "data-video": HTMLAttributes.url }];
  },
  addNodeView() {
    return ReactNodeViewRenderer(VideoView);
  },
});

/* ── Toolbar ───────────────────────────────────────────────────────── */

function ToolButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`inline-flex h-8 min-w-8 items-center justify-center rounded px-1.5 text-[13px] font-semibold transition-colors disabled:opacity-30 ${
        active ? "bg-forest-900 text-white" : "text-forest-900 hover:bg-sand-100"
      }`}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor, onImage }: { editor: Editor; onImage: () => void }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      link: e.isActive("link"),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  const setLink = () => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link address (https://…, /a-page-on-this-site, or mailto:…). Leave empty to remove the link.", previous ?? "https://");
    if (url === null) return;
    if (url.trim() === "" || url.trim() === "https://") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  };

  const addVideo = () => {
    const url = window.prompt("Paste a YouTube link, or the address of an .mp4 file:");
    if (!url?.trim()) return;
    if (!youtubeId(url) && !/^https:\/\/.+\.mp4(\?.*)?$/i.test(url.trim())) {
      window.alert("That is not a YouTube link or an https://….mp4 address.");
      return;
    }
    editor.chain().focus().insertContent({ type: "video", attrs: { url: url.trim() } }).run();
  };

  const sep = <span className="mx-1 h-5 w-px bg-sand-300" aria-hidden="true" />;

  return (
    <div className="sticky top-14 z-10 flex flex-wrap items-center gap-0.5 rounded-t-md border-b border-sand-300 bg-white/95 px-2 py-1.5 backdrop-blur">
      <ToolButton label="Heading" active={s.h2} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        H2
      </ToolButton>
      <ToolButton label="Subheading" active={s.h3} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        H3
      </ToolButton>
      {sep}
      <ToolButton label="Bold" active={s.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
        <b>B</b>
      </ToolButton>
      <ToolButton label="Italic" active={s.italic} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <i>I</i>
      </ToolButton>
      <ToolButton label="Underline" active={s.underline} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <u>U</u>
      </ToolButton>
      <ToolButton label="Link" active={s.link} onClick={setLink}>
        Link
      </ToolButton>
      {sep}
      <ToolButton label="Bulleted list" active={s.bullet} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        • List
      </ToolButton>
      <ToolButton label="Numbered list" active={s.ordered} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        1. List
      </ToolButton>
      <ToolButton label="Quote" active={s.quote} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        “ ”
      </ToolButton>
      <ToolButton label="Divider" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        —
      </ToolButton>
      {sep}
      <ToolButton label="Insert image" onClick={onImage}>
        Image
      </ToolButton>
      <ToolButton
        label="Insert pull quote"
        onClick={() => editor.chain().focus().insertContent({ type: "pullQuote", attrs: { quote: "", attribution: "" } }).run()}
      >
        Pull quote
      </ToolButton>
      <ToolButton
        label="Insert a row of figures"
        onClick={() => editor.chain().focus().insertContent({ type: "statStrip", attrs: { stats: [{ value: "", label: "" }] } }).run()}
      >
        Figures
      </ToolButton>
      <ToolButton label="Insert video" onClick={addVideo}>
        Video
      </ToolButton>
      {sep}
      <ToolButton label="Undo" disabled={!s.canUndo} onClick={() => editor.chain().focus().undo().run()}>
        ↶
      </ToolButton>
      <ToolButton label="Redo" disabled={!s.canRedo} onClick={() => editor.chain().focus().redo().run()}>
        ↷
      </ToolButton>
    </div>
  );
}

/* ── The editor ────────────────────────────────────────────────────── */

export function RichTextEditor({
  id,
  name,
  initial,
  mediaSrc = {},
  onChange,
  invalid,
}: {
  id: string;
  /** When set, the document is kept in a hidden input of this name. */
  name?: string;
  initial: RichDoc;
  /** Current URLs of the images in `initial`, by media id, for display. */
  mediaSrc?: Record<string, string>;
  onChange?: (doc: RichDoc) => void;
  invalid?: boolean;
}) {
  const [json, setJson] = useState(() => JSON.stringify(initial));
  const [picking, setPicking] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false,
        codeBlock: false,
        strike: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
      }),
      Figure,
      PullQuote,
      StatStrip,
      Video,
    ],
    // Fill in each image's current address so it shows in the editor.
    content: withSources(initial, mediaSrc),
    editorProps: {
      attributes: { id, class: "rt-content", "aria-label": "Text editor", ...(invalid ? { "aria-invalid": "true" } : {}) },
    },
    onUpdate: ({ editor: e }) => {
      const doc = stripSources(e.getJSON() as RichDoc);
      setJson(JSON.stringify(doc));
      onChange?.(doc);
    },
  });

  return (
    <div className={`rounded-md border bg-white ${invalid ? "border-red-700" : "border-sand-300"} focus-within:border-forest-900`}>
      {name && <input type="hidden" name={name} value={json} />}
      {editor ? (
        <>
          <Toolbar editor={editor} onImage={() => setPicking(true)} />
          <EditorContent editor={editor} />
        </>
      ) : (
        <div className="h-48 animate-pulse rounded-md bg-sand-50" />
      )}
      <MediaDialog
        open={picking}
        multiple
        onClose={() => setPicking(false)}
        onSelect={(items) => {
          setPicking(false);
          editor
            ?.chain()
            .focus()
            .insertContent(
              items.map((m) => ({ type: "figure", attrs: { mediaId: m.id, src: m.url, alt: m.alt, caption: "" } })),
            )
            .run();
        }}
      />
    </div>
  );
}

function withSources(doc: RichDoc, src: Record<string, string>): RichDoc {
  const walk = (n: RichDoc["content"][number]): RichDoc["content"][number] => ({
    ...n,
    ...(n.type === "figure" ? { attrs: { ...n.attrs, src: src[String(n.attrs?.mediaId)] ?? "" } } : {}),
    ...(n.content ? { content: n.content.map(walk) } : {}),
  });
  return { type: "doc", content: (doc.content ?? []).map(walk) };
}

/** The image address is shown in the editor only; the site looks images up by id. */
function stripSources(doc: RichDoc): RichDoc {
  const walk = (n: RichDoc["content"][number]): RichDoc["content"][number] => {
    if (n.type === "figure" && n.attrs) {
      const { src: _src, ...rest } = n.attrs;
      void _src;
      return { ...n, attrs: rest };
    }
    return n.content ? { ...n, content: n.content.map(walk) } : n;
  };
  return { type: "doc", content: (doc.content ?? []).map(walk) };
}
