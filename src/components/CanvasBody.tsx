import type {
  QuartzComponent,
  QuartzComponentProps,
  QuartzComponentConstructor,
} from "@quartz-community/types";
import type { CanvasData, CanvasNode, CanvasEdge, CanvasPageOptions } from "../types";
import { CANVAS_PRESET_COLORS } from "../types";
import style from "./styles/canvas.scss";
// @ts-ignore
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

function renderNode(
  node: CanvasNode,
  renderedTexts: Record<string, string>,
  embeddedContent: Record<string, string>,
): unknown {
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
      const html = renderedTexts[node.id];
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
      const embedded = embeddedContent[node.id];
      return (
        <div class="canvas-node canvas-node-file" data-node-id={node.id} style={styleStr}>
          <div class="canvas-file-label">
            <a
              href={`/${node.file.replace(/\.md$/, "")}`}
              class="canvas-file-link internal"
              data-slug={node.file.replace(/\.md$/, "")}
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
                href={`/${node.file.replace(/\.md$/, "")}`}
                class="canvas-file-link internal"
                data-slug={node.file.replace(/\.md$/, "")}
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
              class="canvas-link external"
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
    const canvasData = fileData.canvasData as
      | (CanvasData & { renderedTexts?: Record<string, string> })
      | undefined;

    if (!canvasData) {
      return (
        <article class="canvas-page popover-hint">
          <p>No canvas data found.</p>
        </article>
      );
    }

    const nodes = canvasData.nodes ?? [];
    const edges = canvasData.edges ?? [];
    const renderedTexts = canvasData.renderedTexts ?? {};
    const embeddedContent = (fileData.embeddedContent as Record<string, string>) ?? {};

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
    const defaultFullscreen = opts.defaultFullscreen ?? false;

    return (
      <article class="canvas-page popover-hint">
        <div
          class={`canvas-container${defaultFullscreen ? " canvas-fullscreen" : ""}`}
          data-enable-interaction={enableInteraction.toString()}
          data-initial-zoom={initialZoom.toString()}
          data-min-zoom={minZoom.toString()}
          data-max-zoom={maxZoom.toString()}
          data-default-fullscreen={defaultFullscreen.toString()}
        >
          <div class="canvas-controls">
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
                class="canvas-fullscreen-icon-expand"
              >
                <polyline points="15 3 21 3 21 9" />
                <polyline points="9 21 3 21 3 15" />
                <line x1="21" y1="3" x2="14" y2="10" />
                <line x1="3" y1="21" x2="10" y2="14" />
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
                class="canvas-fullscreen-icon-collapse"
              >
                <polyline points="4 14 10 14 10 20" />
                <polyline points="20 10 14 10 14 4" />
                <line x1="14" y1="10" x2="21" y2="3" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            </button>
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
          </div>
          <div class="canvas-viewport" style={`width:${viewWidth}px;height:${viewHeight}px`}>
            <div
              class="canvas-nodes"
              style={`transform:translate(${-minX + padding}px,${-minY + padding}px)`}
            >
              {nodes.map((node) => renderNode(node, renderedTexts, embeddedContent))}
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
