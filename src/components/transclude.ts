import type { FullSlug, QuartzPluginData } from "@quartz-community/types";
import {
  normalizeHastElement,
  obsidianHeadingAnchor,
  slugHeading,
} from "@quartz-community/utils/path";
import type { Element, ElementContent, Root } from "hast";
import { i18n } from "../i18n";

/**
 * Embeds and ids inside a canvas's nodes, the way Quartz renders them on a note.
 *
 * Quartz fills transclusions (`![[Note#Heading]]`) only in a page's own tree; a canvas page's
 * content lives in its nodes, so this plugin fills them itself, with the same markup and rules
 * as Quartz (`quartz/components/renderPage.tsx`, `transcludeScope.ts`), and gives the ids in each
 * node a prefix, unique on the page: two text nodes with `# Same` or a footnote each, or two
 * file nodes showing the same note, would otherwise share ids.
 */

const headerRegex = /^h[1-6]$/;

/** Space-separated id references (hast property names). */
const ID_LIST_PROPERTIES = [
  "ariaDescribedBy",
  "ariaLabelledBy",
  "ariaControls",
  "ariaOwns",
  "ariaDetails",
  "ariaFlowTo",
  "htmlFor",
  "headers",
] as const;

/** Subtrees whose ids are referenced from inside them in ways we don't rewrite (`url(#id)`). */
const OPAQUE = new Set(["svg", "math"]);

function classesOf(el: Element): string[] {
  return ([] as unknown[]).concat(el.properties?.className ?? []).map(String);
}

function forEachElement(node: Element | Root, fn: (el: Element) => void) {
  for (const child of node.children) {
    if (child.type !== "element") continue;
    fn(child);
    if (!OPAQUE.has(child.tagName)) forEachElement(child, fn);
  }
}

/**
 * The block inside Obsidian's per-block wrapper (`div.el-p > p`, `div.el-h2 > h2`), which
 * `@quartz-community/rehype-obsidian` renders around each of a note's top-level blocks; any other
 * node is its own block.
 */
export function blockOf<T extends Root["children"][number]>(node: T): T {
  if (node.type !== "element" || (node as Element).tagName !== "div") return node;
  const el = node as Element;
  if (!classesOf(el).some((c) => /^el-[a-z0-9]+$/.test(c))) return node;
  const inner = el.children.filter((c) => c.type === "element");
  return inner.length === 1 ? (inner[0] as T) : node;
}

/** A heading's text as written, without the anchor link and collapse icon Quartz adds to it. */
function headingText(el: Element): string {
  const heading = el.properties?.dataHeading;
  if (typeof heading === "string") return heading;
  let text = "";
  const walk = (node: Element) => {
    for (const child of node.children) {
      if (child.type === "text") text += child.value;
      else if (child.type === "element") {
        const props = child.properties ?? {};
        if (props.role === "anchor" || String(props.ariaHidden) === "true") continue;
        walk(child);
      }
    }
  };
  walk(el);
  return text.trim();
}

/**
 * Whether the heading `el` is the one a link or embed to `#ref` names. `ref` is the heading's id
 * (`[[note#Heading]]` slugged, as in a transclusion's `data-block`) or its text as Obsidian
 * writes it (a canvas file node's `subpath`: `#Sub Section`, `#Ça va`). A heading answers to its
 * id, the slug of its text (also when `slugs.stripDiacritics` stripped the id's accents), the
 * anchor Obsidian writes for it (`## Colon:unspaced` → `#Colon unspaced`), and the ids of the
 * `span.heading-alias` GitHubFlavoredMarkdown adds for that anchor.
 */
export function headingMatches(el: Element, ref: string): boolean {
  if (el.properties?.id === ref) return true;
  const wanted = slugHeading(ref);
  if (el.properties?.id === wanted) return true;
  const text = headingText(el);
  if (text === ref || slugHeading(text) === wanted) return true;
  if (slugHeading(obsidianHeadingAnchor(text)) === wanted) return true;
  const hasAlias = (node: Element): boolean =>
    node.children.some(
      (child) =>
        child.type === "element" &&
        ((classesOf(child).includes("heading-alias") &&
          (child.properties?.id === ref || child.properties?.id === wanted)) ||
          hasAlias(child)),
    );
  return hasAlias(el);
}

/**
 * The index range of the section under the heading `ref` among a page's top-level nodes: from
 * the heading (inside its block wrapper if it has one) to the next heading of the same or a
 * higher level.
 */
export function findHeadingSection(
  children: Root["children"],
  ref: string,
): { start: number; end: number | undefined } | undefined {
  let start: number | undefined;
  let startDepth: number | undefined;
  for (const [i, child] of children.entries()) {
    const el = blockOf(child);
    if (el.type !== "element" || !headerRegex.test(el.tagName)) continue;
    const depth = Number(el.tagName.substring(1));
    if (start === undefined || startDepth === undefined) {
      if (headingMatches(el, ref)) {
        start = i;
        startDepth = depth;
      }
    } else if (depth <= startDepth) {
      return { start, end: i };
    }
  }
  return start === undefined ? undefined : { start, end: undefined };
}

function isFootnotesSection(node: ElementContent): node is Element {
  node = blockOf(node);
  if (node.type !== "element" || node.tagName !== "section") return false;
  const props = node.properties ?? {};
  return props.dataFootnotes !== undefined || classesOf(node).includes("footnotes");
}

/**
 * A heading section: the slice of the page from `start` to `end`. The page's footnotes section is
 * not part of the section; the footnotes the slice references are added after it.
 */
export function sliceWithFootnotes(
  pageChildren: ElementContent[],
  start: number,
  end: number | undefined,
): ElementContent[] {
  const slice = pageChildren.slice(start, end).filter((node): boolean => !isFootnotesSection(node));
  const section = pageChildren.find(isFootnotesSection);
  if (!section) return slice;

  const referenced = new Set<string>();
  for (const node of slice) {
    if (node.type !== "element") continue;
    forEachElement({ type: "root", children: [node] }, (child) => {
      const href = child.properties?.href;
      if (child.properties?.dataFootnoteRef !== undefined && typeof href === "string")
        referenced.add(href.replace(/^#/, ""));
    });
  }
  if (referenced.size === 0) return slice;

  const copy = structuredClone(section) as Element;
  forEachElement(copy, (node) => {
    if (node.tagName !== "ol") return;
    node.children = node.children.filter(
      (item) =>
        item.type !== "element" ||
        item.tagName !== "li" ||
        referenced.has(String(item.properties?.id ?? "")),
    );
  });
  return [...slice, copy];
}

/** Per page render: a prefix for each scope (node, transclusion), unique on the page. */
export function createIdScopes(): (target: string) => string {
  const used = new Map<string, number>();
  return (target) => {
    const base =
      (target.split("/").pop() ?? target)
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/^-+|-+$/g, "") || "transclude";
    const count = (used.get(base) ?? 0) + 1;
    used.set(base, count);
    return count === 1 ? `${base}--` : `${base}-${count}--`;
  };
}

/**
 * Prefixes the ids inside `el` with `prefix` and rewrites the references to them inside it
 * (`href="#id"`, `aria-describedby`, …). `sourceHref` is the link to the page the content comes
 * from, for same-page links whose target isn't inside `el` (a heading section that doesn't hold
 * it); without it such links are left as they are.
 */
export function scopeIds(el: Element | Root, prefix: string, sourceHref?: string) {
  const ids = new Set<string>();
  forEachElement(el, (node) => {
    const id = node.properties?.id;
    if (typeof id === "string" && id) ids.add(id);
  });

  const pageHref = typeof sourceHref === "string" ? sourceHref.split("#")[0] : undefined;
  const scoped = (id: string) => (ids.has(id) ? `${prefix}${id}` : id);

  forEachElement(el, (node) => {
    const props = node.properties;
    if (!props) return;
    if (typeof props.id === "string" && ids.has(props.id)) props.id = `${prefix}${props.id}`;

    const href = props.href;
    if (typeof href === "string" && href.startsWith("#") && href.length > 1) {
      let target = href.slice(1);
      try {
        target = decodeURIComponent(target);
      } catch {
        // keep as written
      }
      if (ids.has(target)) props.href = `#${prefix}${target}`;
      else if (pageHref) props.href = `${pageHref}${href}`;
    }

    const record = props as Record<string, unknown>;
    for (const name of ID_LIST_PROPERTIES) {
      const value = record[name];
      if (Array.isArray(value)) record[name] = value.map((token) => scoped(String(token)));
      else if (typeof value === "string") record[name] = value.split(/\s+/).map(scoped).join(" ");
    }
  });
}

export function findPage(
  fileSlug: FullSlug,
  allFiles: QuartzPluginData[],
): QuartzPluginData | undefined {
  let page = allFiles.find((f) => f.slug === fileSlug);
  if (!page) {
    // Virtual pages from pageType plugins have slugs without extensions
    const dotIdx = fileSlug.lastIndexOf(".");
    const slashIdx = fileSlug.lastIndexOf("/");
    if (dotIdx > slashIdx + 1) {
      const stripped = fileSlug.slice(0, dotIdx) as FullSlug;
      page = [...allFiles].reverse().find((f) => f.slug === stripped);
    }
  }
  return page;
}

/** Lucide's maximize-2, Obsidian's icon for opening an embedded note. */
function maximizeIcon(): Element {
  return {
    type: "element",
    tagName: "svg",
    properties: {
      xmlns: "http://www.w3.org/2000/svg",
      width: "24",
      height: "24",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      className: ["svg-icon", "lucide-maximize-2"],
    },
    children: ["M15 3h6v6", "m21 3-7 7", "m3 21 7-7", "M9 21H3v-6"].map((d) => ({
      type: "element" as const,
      tagName: "path",
      properties: { d },
      children: [],
    })),
  };
}

/** Obsidian's embed markup around transcluded content, as Quartz renders it. */
function obsidianEmbed(title: string, content: ElementContent[], link: Element): ElementContent[] {
  const embedLink: Element = {
    type: "element",
    tagName: "a",
    properties: {
      href: link.properties.href,
      className: ["markdown-embed-link"],
      ariaLabel: (link.children[0] as { value?: string } | undefined)?.value,
      dataNoPopover: true,
    },
    children: [maximizeIcon()],
  };
  return [
    {
      type: "element",
      tagName: "div",
      properties: { className: ["embed-title", "markdown-embed-title"] },
      children: title ? [{ type: "text", value: title }] : [],
    },
    {
      type: "element",
      tagName: "div",
      properties: { className: ["markdown-embed-content"] },
      children: [
        {
          type: "element",
          tagName: "div",
          properties: { className: ["markdown-preview-view", "markdown-rendered"] },
          children: content,
        },
      ],
    },
    link,
    embedLink,
  ];
}

export interface TranscludeContext {
  /** The canvas page's slug: links inside embedded content are rebased to it. */
  slug: FullSlug;
  allFiles: QuartzPluginData[];
  /** Pages being embedded around this point (the canvas itself first): their embeds are cycles. */
  visited: Set<string>;
  locale?: string;
  /** A prefix per transclusion, unique on the canvas page. */
  scopeFor: (target: string) => string;
}

/**
 * Fill the transclusions (`div.transclude`, `blockquote.transclude` before Quartz 5.2) in `root`
 * as Quartz does on a note: a block (`#^id`), a heading section (`#Heading`) or the whole page,
 * in Obsidian's embed markup, nested transclusions included and cycles cut. Each transclusion's
 * ids get a prefix of their own.
 */
export function renderTranscludes(root: Element | Root, tctx: TranscludeContext) {
  const { slug, allFiles, visited, locale, scopeFor } = tctx;
  const t = i18n(locale ?? "en-US").components.transcludes;

  const walk = (node: Element | Root) => {
    for (const child of node.children) {
      if (child.type !== "element") continue;
      const el = child;
      if (
        (el.tagName !== "div" && el.tagName !== "blockquote") ||
        !classesOf(el).includes("transclude")
      ) {
        walk(el);
        continue;
      }

      const inner = el.children.find((c): c is Element => c.type === "element");
      if (!inner) continue;
      const linkToOriginal = (): Element => ({
        type: "element",
        tagName: "a",
        properties: {
          href: inner.properties?.href,
          class: ["internal", "internal-link", "transclude-src"],
        },
        children: [{ type: "text", value: t.linkToOriginal }],
      });
      const target = (inner.properties?.dataSlug ??
        inner.properties?.["data-slug"] ??
        slug) as FullSlug;
      if (visited.has(target)) {
        el.children = [
          {
            type: "element",
            tagName: "p",
            properties: { style: "color: var(--secondary);" },
            children: [{ type: "text", value: `Circular transclusion detected: ${target}` }],
          },
        ];
        continue;
      }

      const page = findPage(target, allFiles);
      if (!page) continue;
      const htmlAst = (page as { htmlAst?: Root }).htmlAst;
      const rebase = (c: ElementContent) =>
        c.type === "element" ? normalizeHastElement(c, slug, page.slug as FullSlug) : c;

      let filled = false;
      const ref = el.properties?.dataBlock as string | undefined;
      if (ref?.startsWith("#^")) {
        const blocks = (page as { blocks?: Record<string, Element> }).blocks;
        let blockNode = blocks?.[ref.slice(2)];
        if (blockNode) {
          if (blockNode.tagName === "li") {
            blockNode = { type: "element", tagName: "ul", properties: {}, children: [blockNode] };
          }
          el.children = obsidianEmbed("", [rebase(structuredClone(blockNode))], linkToOriginal());
          filled = true;
        }
      } else if (ref?.startsWith("#") && ref.length > 1 && htmlAst) {
        const section = findHeadingSection(htmlAst.children, ref.slice(1));
        if (section) {
          el.children = obsidianEmbed(
            "",
            sliceWithFootnotes(
              structuredClone(htmlAst.children) as ElementContent[],
              section.start,
              section.end,
            ).map(rebase),
            linkToOriginal(),
          );
          filled = true;
        }
      } else if (htmlAst) {
        el.children = obsidianEmbed(
          (page.frontmatter?.title as string | undefined) ??
            t.transcludeOf({ targetSlug: String(page.slug) }),
          (structuredClone(htmlAst.children) as ElementContent[]).map(rebase),
          linkToOriginal(),
        );
        filled = true;
      }
      if (!filled) continue;

      visited.add(target);
      walk(el);
      visited.delete(target);
      scopeIds(el, scopeFor(target), inner.properties?.href as string | undefined);
    }
  };
  walk(root);
}

function isEmptyParagraph(node: ElementContent): boolean {
  if (node.type !== "element") return false;
  const el = blockOf(node);
  if (el.type !== "element" || el.tagName !== "p") return false;
  return el.children.every((c) => c.type === "text" && c.value.trim() === "");
}

/**
 * Drop the empty paragraphs (`<p></p>`, in its block wrapper) Markdown leaves around an embed on
 * a line of its own: the embed is a block inside the paragraph, which HTML splits around it.
 */
export function removeEmptyParagraphs(node: Element | Root) {
  node.children = (node.children as ElementContent[]).filter(
    (child) => !isEmptyParagraph(child),
  ) as typeof node.children;
  for (const child of node.children) {
    if (child.type === "element" && !OPAQUE.has(child.tagName)) removeEmptyParagraphs(child);
  }
}
