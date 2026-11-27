/**
 * The path of a canvas edge, as Obsidian draws it (measured with dev-mode's obsidian-bases-probe
 * on Obsidian 1.15.1, `canvas.edges[…].path.display`):
 *
 * - Each end sits on its node's border, in the middle of its side, and runs a 7px straight stub
 *   out of that side; a cubic curve joins the two stubs.
 * - Each control point lies along its side's outward direction, at half the distance between
 *   the stub ends, kept within 70–150px. So an edge leaves a `top` side upwards and enters a
 *   `left` side from the left, and its arrow points into the side.
 * - An end without a side gets the side through which the line from its node's centre to the
 *   other node's centre leaves the node (each end on its own, so `bottom` to `left` happens).
 */
export type CanvasSide = "top" | "right" | "bottom" | "left";

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Point {
  x: number;
  y: number;
}

export const EDGE_STUB = 7;
const MIN_CONTROL = 70;
const MAX_CONTROL = 150;

const DIRECTIONS: Record<CanvasSide, Point> = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};

function isSide(side: unknown): side is CanvasSide {
  return typeof side === "string" && side in DIRECTIONS;
}

/** The side of `node` facing `other`, as Obsidian picks it for an edge end without one. */
export function autoSide(node: Box, other: Box): CanvasSide {
  const dx = other.x + other.width / 2 - (node.x + node.width / 2);
  const dy = other.y + other.height / 2 - (node.y + node.height / 2);
  if (Math.abs(dx) / (node.width / 2) > Math.abs(dy) / (node.height / 2)) {
    return dx > 0 ? "right" : "left";
  }
  return dy > 0 ? "bottom" : "top";
}

function sideAnchor(node: Box, side: CanvasSide): Point {
  switch (side) {
    case "top":
      return { x: node.x + node.width / 2, y: node.y };
    case "bottom":
      return { x: node.x + node.width / 2, y: node.y + node.height };
    case "left":
      return { x: node.x, y: node.y + node.height / 2 };
    case "right":
      return { x: node.x + node.width, y: node.y + node.height / 2 };
  }
}

export interface EdgeGeometry {
  /** SVG path data, from the border of `from` to the border of `to`. */
  d: string;
  /** The middle of the curve, where Obsidian puts the label. */
  mid: Point;
  fromSide: CanvasSide;
  toSide: CanvasSide;
}

const round = (n: number) => Math.round(n * 100) / 100;

export function edgeGeometry(from: Box, to: Box, fromSide?: string, toSide?: string): EdgeGeometry {
  const sideFrom = isSide(fromSide) ? fromSide : autoSide(from, to);
  const sideTo = isSide(toSide) ? toSide : autoSide(to, from);
  const a = sideAnchor(from, sideFrom);
  const b = sideAnchor(to, sideTo);
  const da = DIRECTIONS[sideFrom];
  const db = DIRECTIONS[sideTo];
  const s = { x: a.x + da.x * EDGE_STUB, y: a.y + da.y * EDGE_STUB };
  const e = { x: b.x + db.x * EDGE_STUB, y: b.y + db.y * EDGE_STUB };
  const k = Math.min(MAX_CONTROL, Math.max(MIN_CONTROL, Math.hypot(e.x - s.x, e.y - s.y) / 2));
  const c1 = { x: s.x + da.x * k, y: s.y + da.y * k };
  const c2 = { x: e.x + db.x * k, y: e.y + db.y * k };
  const p = (pt: Point) => `${round(pt.x)} ${round(pt.y)}`;
  return {
    d: `M ${p(a)} L ${p(s)} C ${p(c1)}, ${p(c2)}, ${p(e)} L ${p(b)}`,
    mid: {
      x: round((s.x + 3 * c1.x + 3 * c2.x + e.x) / 8),
      y: round((s.y + 3 * c1.y + 3 * c2.y + e.y) / 8),
    },
    fromSide: sideFrom,
    toSide: sideTo,
  };
}
