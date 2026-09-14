import Image from "@tiptap/extension-image";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { useRef, type PointerEvent as ReactPointerEvent } from "react";

export type ImageAlignment = "left" | "center" | "right";

export function normalizeImageWidth(value: unknown): number {
  const parsed = Number.parseFloat(String(value ?? "100"));
  if (!Number.isFinite(parsed)) return 100;
  return Math.min(100, Math.max(20, Math.round(parsed)));
}

export function normalizeImageAlignment(value: unknown): ImageAlignment {
  return value === "left" || value === "right" ? value : "center";
}

function alignmentClass(alignment: ImageAlignment) {
  if (alignment === "left") return "mr-auto ml-0";
  if (alignment === "right") return "ml-auto mr-0";
  return "mx-auto";
}

const handlePositions = {
  "top-left": "-left-1.5 -top-1.5 cursor-nwse-resize",
  "top-right": "-right-1.5 -top-1.5 cursor-nesw-resize",
  "bottom-left": "-bottom-1.5 -left-1.5 cursor-nesw-resize",
  "bottom-right": "-bottom-1.5 -right-1.5 cursor-nwse-resize",
} as const;

type ResizeCorner = keyof typeof handlePositions;

function ResizableImageView({ node, selected, updateAttributes }: ReactNodeViewProps) {
  const wrapperRef = useRef<HTMLElement | null>(null);
  const width = normalizeImageWidth(node.attrs.width);
  const alignment = normalizeImageAlignment(node.attrs.align);

  const startResize = (corner: ResizeCorner) => (event: ReactPointerEvent<HTMLSpanElement>) => {
    const wrapper = wrapperRef.current;
    const parent = wrapper?.parentElement;
    if (!wrapper || !parent) return;

    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = wrapper.getBoundingClientRect().width;
    const parentWidth = parent.getBoundingClientRect().width || startWidth;
    const direction = corner.includes("left") ? -1 : 1;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";

    const move = (moveEvent: PointerEvent) => {
      const nextPixels = startWidth + ((moveEvent.clientX - startX) * direction);
      updateAttributes({ width: normalizeImageWidth((nextPixels / parentWidth) * 100) });
    };
    const stop = () => {
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop, { once: true });
    window.addEventListener("pointercancel", stop, { once: true });
  };

  return (
    <NodeViewWrapper
      as="figure"
      ref={wrapperRef}
      data-width={width}
      data-align={alignment}
      className={`relative my-3 block max-w-full ${alignmentClass(alignment)} ${selected ? "ring-2 ring-primary ring-offset-2" : ""}`}
      style={{ width: `${width}%` }}
    >
      <img
        src={node.attrs.src}
        alt={node.attrs.alt || ""}
        title={node.attrs.title || undefined}
        draggable={false}
        className="m-0 block h-auto w-full max-w-full rounded-lg border border-border object-contain"
      />
      {selected && (
        <>
          <span className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded bg-foreground/80 px-2 py-0.5 text-[10px] font-semibold text-background">
            {width}%
          </span>
          {Object.entries(handlePositions).map(([corner, position]) => (
            <span
              key={corner}
              role="button"
              aria-label={`Resize image from ${corner.replace("-", " ")}`}
              title="Drag to resize"
              onPointerDown={startResize(corner as ResizeCorner)}
              className={`absolute z-10 h-3.5 w-3.5 rounded-sm border-2 border-background bg-primary shadow ${position}`}
            />
          ))}
        </>
      )}
    </NodeViewWrapper>
  );
}

export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: 100,
        parseHTML: (element) => normalizeImageWidth(
          element.getAttribute("data-width")
          || element.style.width
          || element.getAttribute("width"),
        ),
        renderHTML: (attributes) => {
          const width = normalizeImageWidth(attributes.width);
          return { "data-width": String(width), style: `width: ${width}%;` };
        },
      },
      align: {
        default: "center",
        parseHTML: (element) => normalizeImageAlignment(element.getAttribute("data-align")),
        renderHTML: (attributes) => ({ "data-align": normalizeImageAlignment(attributes.align) }),
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView);
  },
});
