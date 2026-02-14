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
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;

  switch (side) {
    case "top":
      return { x: cx, y: node.y };
    case "bottom":
      return { x: cx, y: node.y + node.height };
    case "left":
      return { x: node.x, y: cy };
    case "right":
      return { x: node.x + node.width, y: cy };
    default:
      return { x: cx, y: cy };
  }
}

function renderNode(node: CanvasNode): unknown {
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
    case "text":
      return (
        <div class="canvas-node canvas-node-text" data-node-id={node.id} style={styleStr}>
          <div class="canvas-node-content">{node.text}</div>
        </div>
      );

    case "file":
      return (
        <div class="canvas-node canvas-node-file" data-node-id={node.id} style={styleStr}>
          <div class="canvas-node-content">
            <a href={`/${node.file.replace(/\.md$/, "")}`} class="canvas-file-link">
              {node.file.split("/").pop()?.replace(/\.md$/, "") ?? node.file}
            </a>
            {node.subpath && <span class="canvas-file-subpath">{node.subpath}</span>}
          </div>
        </div>
      );

    case "link":
      return (
        <div class="canvas-node canvas-node-link" data-node-id={node.id} style={styleStr}>
          <div class="canvas-node-content">
            <a
              href={node.url}
              class="canvas-link external"
              target="_blank"
              rel="noopener noreferrer"
            >
              {new URL(node.url).hostname}
            </a>
          </div>
        </div>
      );

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
        <text x={midX} y={midY} class="canvas-edge-label" text-anchor="middle" dy="-8">
          {edge.label}
        </text>
      )}
    </g>
  );
}

export default ((userOpts?: CanvasPageOptions) => {
  const Component: QuartzComponent = (props: QuartzComponentProps) => {
    const fileData = props.fileData as Record<string, unknown>;
    const canvasData = fileData.canvasData as CanvasData | undefined;

    if (!canvasData) {
      return (
        <article class="canvas-page">
          <p>No canvas data found.</p>
        </article>
      );
    }

    const nodes = canvasData.nodes ?? [];
    const edges = canvasData.edges ?? [];

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

    return (
      <article class="canvas-page">
        <div
          class="canvas-container"
          data-enable-interaction={enableInteraction.toString()}
          data-initial-zoom={initialZoom.toString()}
          data-min-zoom={minZoom.toString()}
          data-max-zoom={maxZoom.toString()}
        >
          <div class="canvas-viewport" style={`width:${viewWidth}px;height:${viewHeight}px`}>
            <div
              class="canvas-nodes"
              style={`transform:translate(${-minX + padding}px,${-minY + padding}px)`}
            >
              {nodes.map((node) => renderNode(node))}
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
