import type {
  QuartzComponent,
  QuartzComponentProps,
  QuartzComponentConstructor,
  QuartzPluginData,
  FilePath,
  FullSlug,
} from "@quartz-community/types";
import {
  resolveRelative,
  slugifyFilePath,
  normalizeHastElement,
} from "@quartz-community/utils/path";
import { toHtml } from "hast-util-to-html";
import type { Element as HastElement, ElementContent, Root as HastRoot } from "hast";
import type {
  CanvasData,
  CanvasNode,
  CanvasEdge,
  CanvasPageOptions,
  CanvasRenderedTexts,
} from "../types";
import { CANVAS_PRESET_COLORS } from "../types";
import {
  createIdScopes,
  findHeadingSection,
  findPage,
  removeEmptyParagraphs,
  renderTranscludes,
  scopeIds,
  scopeHtmlIds,
  sliceWithFootnotes,
} from "./transclude";
import style from "./styles/canvas.scss";
// @ts-expect-error inline script import handled by bundler
import script from "./scripts/canvas.inline.ts";

function resolveColor(color?: string): string | undefined {
  if (!color) return undefined;
  if (color.startsWith("#")) return color;
  return CANVAS_PRESET_COLORS[color] ?? undefined;
}

function getEdgeAnchor(node: CanvasNode, side: string | undefined): { x: number; y: number } {
  const border = node.type === "group" ? 2 : 2;
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;

  switch (side) {
    case "top":
      return { x: cx, y: node.y - border };
    case "bottom":
      return { x: cx, y: node.y + node.height + border };
    case "left":
      return { x: node.x - border, y: cy };
    case "right":
      return { x: node.x + node.width + border, y: cy };
    default:
      return { x: cx, y: cy };
  }
}

/**
 * Extract a subset of a HAST tree based on a subpath reference.
 *
 * - `#^blockid`  → block transclude from page.blocks
 * - `#view-name` on a .base page → filter to the named bases view
 * - `#heading`   on other pages  → extract the heading section (the heading as Obsidian stores
 *   it in a file node's `subpath`: its text, e.g. `#Sub Section`, or its id)
 */
function applySubpath(
  htmlAst: HastRoot,
  page: QuartzPluginData,
  subpath: string,
  isBasePage: boolean,
): HastRoot | undefined {
  if (subpath.startsWith("#^")) {
    const blockId = subpath.slice(2);
    const blocks = (page as Record<string, unknown>).blocks as
      Record<string, HastElement> | undefined;
    const blockNode = blocks?.[blockId];
    if (!blockNode) return undefined;
    const wrapped =
      blockNode.tagName === "li"
        ? { type: "element" as const, tagName: "ul", properties: {}, children: [blockNode] }
        : blockNode;
    return { type: "root", children: [wrapped] };
  }

  const ref = subpath.startsWith("#") ? subpath.slice(1) : subpath;
  if (!ref) return htmlAst;

  if (isBasePage) {
    // For .base files, #view-name selects a specific view by data-view-type or
    // the view tab label. Walk the htmlAst to find the matching view div and
    // return only that view, marked active.
    const refLower = ref.toLowerCase();
    for (const child of htmlAst.children) {
      if (child.type !== "element") continue;
      const found = findBasesView(child as HastElement, refLower);
      if (found) return { type: "root", children: [found] };
    }
    return undefined;
  }

  // Header transclude: the heading, then the content until the next heading of equal or lesser
  // depth, and the footnotes it references.
  const section = findHeadingSection(htmlAst.children, ref);
  if (!section) return undefined;
  return {
    type: "root",
    children: sliceWithFootnotes(
      htmlAst.children as ElementContent[],
      section.start,
      section.end,
    ) as HastRoot["children"],
  };
}

function findBasesView(el: HastElement, viewName: string): HastElement | undefined {
  const classes = ((el.properties?.className ?? []) as string[]).join(" ");
  if (classes.includes("bases-view") && !classes.includes("bases-view-container")) {
    const viewType = (el.properties?.dataViewType as string) ?? "";
    if (viewType.toLowerCase() === viewName) return el;
  }
  for (const child of el.children) {
    if (child.type !== "element") continue;
    const found = findBasesView(child as HastElement, viewName);
    if (found) return found;
  }
  return undefined;
}

/**
 * The content of the page `fileSlug` (or the part `subpath` names), with its links rebased to
 * the canvas page `canvasSlug`; `undefined` when there is none or it would embed a page in
 * `visited` (a cycle).
 */
export function resolveEmbeddedTree(
  fileSlug: FullSlug,
  canvasSlug: FullSlug,
  allFiles: QuartzPluginData[],
  subpath?: string,
  visited?: Set<string>,
): { tree: HastRoot; sourceSlug: FullSlug } | undefined {
  if (visited?.has(fileSlug as string)) return undefined;

  const page = findPage(fileSlug, allFiles);
  if (!page) return undefined;

  const htmlAst = (page as Record<string, unknown>).htmlAst as HastRoot | undefined;
  if (!htmlAst) return undefined;

  const sourceSlug = page.slug as FullSlug | undefined;
  if (!sourceSlug) return undefined;
  if (visited?.has(sourceSlug as string)) return undefined;

  let tree = htmlAst;
  if (subpath) {
    const isBasePage = "basesData" in (page as Record<string, unknown>);
    const sub = applySubpath(htmlAst, page, subpath, isBasePage);
    if (!sub) return undefined;
    tree = sub;
  }

  const rebased: HastRoot = {
    type: "root",
    children: (structuredClone(tree.children) as HastRoot["children"]).map((child) =>
      child.type === "element"
        ? (normalizeHastElement(child as HastElement, canvasSlug, sourceSlug) as typeof child)
        : child,
    ),
  };
  return { tree: rebased, sourceSlug };
}

export function resolveEmbeddedHtml(
  fileSlug: FullSlug,
  canvasSlug: FullSlug,
  allFiles: QuartzPluginData[],
  subpath?: string,
  visited?: Set<string>,
): string | undefined {
  const embedded = resolveEmbeddedTree(fileSlug, canvasSlug, allFiles, subpath, visited);
  if (!embedded) return undefined;
  return toHtml(embedded.tree as Parameters<typeof toHtml>[0], { allowDangerousHtml: true });
}

interface NodeRenderContext {
  slug: FullSlug;
  allFiles: QuartzPluginData[];
  visited: Set<string>;
  locale?: string;
  /** A prefix per node and per transclusion, unique on the page, for the ids inside it. */
  scopeFor: (target: string) => string;
}

/**
 * A node's content as HTML: its transclusions filled (as Quartz does on a note) and its ids
 * prefixed, so the ids of different nodes (`# Same` in two text nodes, their footnotes, two
 * file nodes showing the same note) don't clash and the links inside each node go to its own.
 */
function finishNodeContent(
  tree: HastRoot,
  nodeId: string,
  rctx: NodeRenderContext,
  sourceHref?: string,
): string {
  renderTranscludes(tree, rctx);
  removeEmptyParagraphs(tree);
  scopeIds(tree, rctx.scopeFor(`node-${nodeId}`), sourceHref);
  return toHtml(tree as Parameters<typeof toHtml>[0], { allowDangerousHtml: true });
}

function renderNode(
  node: CanvasNode,
  rendered: CanvasRenderedTexts,
  rctx: NodeRenderContext,
): unknown {
  const { slug, allFiles, visited } = rctx;
  const color = resolveColor(node.color);
  const baseStyle: Record<string, string> = {
    left: `${node.x}px`,
    top: `${node.y}px`,
    width: `${node.width}px`,
    height: `${node.height}px`,
  };
  if (color) {
    baseStyle["--canvas-node-color"] = color;
  }

  const styleStr = Object.entries(baseStyle)
    .map(([k, v]) => `${k}:${v}`)
    .join(";");

  switch (node.type) {
    case "text": {
      const tree = rendered.renderedTrees?.[node.id];
      const basic = rendered.renderedTexts?.[node.id];
      const html = tree
        ? finishNodeContent(structuredClone(tree), node.id, rctx)
        : basic && scopeHtmlIds(basic, rctx.scopeFor(`node-${node.id}`));
      return (
        <div class="canvas-node canvas-node-text" data-node-id={node.id} style={styleStr}>
          {html ? (
            <div class="canvas-node-content" dangerouslySetInnerHTML={{ __html: html }} />
          ) : (
            <div class="canvas-node-content">{node.text}</div>
          )}
        </div>
      );
    }

    case "file": {
      const filename = node.file.split("/").pop()?.replace(/\.md$/, "") ?? node.file;
      const fileSlug = slugifyFilePath(node.file as FilePath) as FullSlug;
      const isImage = /\.(png|jpe?g|gif|svg|webp|avif|bmp|ico)$/i.test(node.file);

      if (isImage) {
        return (
          <div
            class="canvas-node canvas-node-file canvas-node-image"
            data-node-id={node.id}
            style={styleStr}
          >
            <img src={resolveRelative(slug, fileSlug)} alt={filename} loading="lazy" />
          </div>
        );
      }

      const found = resolveEmbeddedTree(fileSlug, slug, allFiles, node.subpath, visited);
      let embedded: string | undefined;
      if (found) {
        // the embedded page's own embeds are filled too; embedding the canvas again is a cycle
        visited.add(found.sourceSlug);
        embedded = finishNodeContent(found.tree, node.id, rctx, resolveRelative(slug, fileSlug));
        visited.delete(found.sourceSlug);
      }

      return (
        <div class="canvas-node canvas-node-file" data-node-id={node.id} style={styleStr}>
          <div class="canvas-file-label">
            <a
              href={resolveRelative(slug, fileSlug)}
              class="canvas-file-link internal internal-link"
              data-slug={fileSlug}
            >
              {filename}
            </a>
            {node.subpath && <span class="canvas-file-subpath">{node.subpath}</span>}
          </div>
          <div class="canvas-node-content">
            {embedded ? (
              <div class="canvas-embed-content" dangerouslySetInnerHTML={{ __html: embedded }} />
            ) : (
              <a
                href={resolveRelative(slug, fileSlug)}
                class="canvas-file-link internal internal-link"
                data-slug={fileSlug}
              >
                {filename}
              </a>
            )}
          </div>
        </div>
      );
    }

    case "link": {
      let hostname: string;
      try {
        hostname = new URL(node.url).hostname;
      } catch {
        hostname = node.url;
      }
      return (
        <div class="canvas-node canvas-node-link" data-node-id={node.id} style={styleStr}>
          <div class="canvas-link-label">
            <a
              href={node.url}
              class="canvas-link external external-link"
              target="_blank"
              rel="noopener noreferrer"
            >
              {hostname}
            </a>
          </div>
          <div class="canvas-node-content canvas-iframe-wrapper">
            <iframe
              src={node.url}
              title={hostname}
              sandbox="allow-scripts allow-same-origin allow-popups"
              loading="lazy"
              referrerpolicy="no-referrer"
            />
            <div class="canvas-iframe-fallback">
              <a href={node.url} target="_blank" rel="noopener noreferrer">
                Open {hostname} in new tab
              </a>
            </div>
          </div>
        </div>
      );
    }

    case "group":
      return (
        <div class="canvas-node canvas-node-group" data-node-id={node.id} style={styleStr}>
          {node.label && <div class="canvas-group-label">{node.label}</div>}
        </div>
      );

    default:
      return null;
  }
}

function renderEdge(edge: CanvasEdge, nodeMap: Map<string, CanvasNode>): unknown {
  const fromNode = nodeMap.get(edge.fromNode);
  const toNode = nodeMap.get(edge.toNode);
  if (!fromNode || !toNode) return null;

  const from = getEdgeAnchor(fromNode, edge.fromSide);
  const to = getEdgeAnchor(toNode, edge.toSide);

  const color = resolveColor(edge.color);
  const hasFromArrow = edge.fromEnd === "arrow";
  const hasToArrow = (edge.toEnd ?? "arrow") === "arrow";

  const markerId = `arrow-${edge.id}`;
  const markerStartId = `arrow-start-${edge.id}`;

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const midX = from.x + dx / 2;
  const midY = from.y + dy / 2;
  const pathD = `M ${from.x} ${from.y} Q ${midX} ${from.y}, ${midX} ${midY} T ${to.x} ${to.y}`;

  return (
    <g class="canvas-edge" data-edge-id={edge.id}>
      <defs>
        {hasToArrow && (
          <marker
            id={markerId}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={color ?? "var(--darkgray)"} />
          </marker>
        )}
        {hasFromArrow && (
          <marker
            id={markerStartId}
            viewBox="0 0 10 10"
            refX="1"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 10 0 L 0 5 L 10 10 z" fill={color ?? "var(--darkgray)"} />
          </marker>
        )}
      </defs>
      <path
        d={pathD}
        fill="none"
        stroke={color ?? "var(--darkgray)"}
        stroke-width="2"
        marker-end={hasToArrow ? `url(#${markerId})` : undefined}
        marker-start={hasFromArrow ? `url(#${markerStartId})` : undefined}
      />
      {edge.label && (
        <g class="canvas-edge-label-group">
          <rect
            x={midX - edge.label.length * 3.5 - 4}
            y={midY - 20}
            width={edge.label.length * 7 + 8}
            height={16}
            rx="3"
            class="canvas-edge-label-bg"
          />
          <text x={midX} y={midY} class="canvas-edge-label" text-anchor="middle" dy="-8">
            {edge.label}
          </text>
        </g>
      )}
    </g>
  );
}

export default ((userOpts?: CanvasPageOptions) => {
  const Component: QuartzComponent = (props: QuartzComponentProps) => {
    const fileData = props.fileData as Record<string, unknown>;
    const slug = (props.fileData.slug ?? "") as FullSlug;
    const canvasData = fileData.canvasData as (CanvasData & CanvasRenderedTexts) | undefined;

    if (!canvasData) {
      return (
        <article class="canvas-page popover-hint">
          <p>No canvas data found.</p>
        </article>
      );
    }

    const nodes = canvasData.nodes ?? [];
    const edges = canvasData.edges ?? [];
    const rctx: NodeRenderContext = {
      slug,
      allFiles: props.allFiles,
      visited: new Set<string>([slug]),
      locale: (props.cfg as { locale?: string } | undefined)?.locale,
      scopeFor: createIdScopes(),
    };

    const nodeMap = new Map<string, CanvasNode>();
    for (const node of nodes) {
      nodeMap.set(node.id, node);
    }

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const node of nodes) {
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + node.width);
      maxY = Math.max(maxY, node.y + node.height);
    }

    if (nodes.length === 0) {
      minX = minY = 0;
      maxX = maxY = 100;
    }

    const padding = 50;
    const viewWidth = maxX - minX + padding * 2;
    const viewHeight = maxY - minY + padding * 2;

    const opts = userOpts ?? {};
    const enableInteraction = opts.enableInteraction ?? true;
    const initialZoom = opts.initialZoom ?? 1;
    const minZoom = opts.minZoom ?? 0.1;
    const maxZoom = opts.maxZoom ?? 5;
    const wheelBehavior = opts.wheelBehavior === "zoom" ? "zoom" : "pan";
    return (
      <article class="canvas-page popover-hint">
        <div
          class="canvas-container"
          data-enable-interaction={enableInteraction.toString()}
          data-initial-zoom={initialZoom.toString()}
          data-min-zoom={minZoom.toString()}
          data-max-zoom={maxZoom.toString()}
          data-wheel-behavior={wheelBehavior}
        >
          <div class="canvas-controls">
            <div class="canvas-zoom-group">
              <button class="canvas-zoom-in" type="button" aria-label="Zoom in">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  <line x1="11" y1="8" x2="11" y2="14" />
                  <line x1="8" y1="11" x2="14" y2="11" />
                </svg>
              </button>
              <button class="canvas-zoom-out" type="button" aria-label="Zoom out">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  <line x1="8" y1="11" x2="14" y2="11" />
                </svg>
              </button>
            </div>
            <button
              class="canvas-reset-view"
              type="button"
              aria-label="Reset view"
              style="display:none"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
            </button>
            <button class="canvas-fullscreen-toggle" type="button" aria-label="Toggle fullscreen">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="canvas-fullscreen-enter"
              >
                <path d="M8 3H5a2 2 0 0 0-2 2v3" />
                <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
                <path d="M3 16v3a2 2 0 0 0 2 2h3" />
                <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
              </svg>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="canvas-fullscreen-exit"
                style="display:none"
              >
                <path d="M8 3v3a2 2 0 0 1-2 2H3" />
                <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
                <path d="M3 16h3a2 2 0 0 1 2 2v3" />
                <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
              </svg>
            </button>
          </div>
          <div class="canvas-viewport" style={`width:${viewWidth}px;height:${viewHeight}px`}>
            <div
              class="canvas-nodes"
              style={`transform:translate(${-minX + padding}px,${-minY + padding}px)`}
            >
              {nodes.map((node) => renderNode(node, canvasData, rctx))}
            </div>
            <svg
              class="canvas-edges"
              width={viewWidth}
              height={viewHeight}
              viewBox={`${minX - padding} ${minY - padding} ${viewWidth} ${viewHeight}`}
            >
              {edges.map((edge) => renderEdge(edge, nodeMap))}
            </svg>
          </div>
        </div>
      </article>
    );
  };

  Component.css = style;
  Component.afterDOMLoaded = script;

  return Component;
}) satisfies QuartzComponentConstructor;
