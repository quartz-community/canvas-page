import { describe, expect, it } from "vitest";
import type { QuartzPluginData } from "@quartz-community/types";
import CanvasBody from "../src/components/CanvasBody";
import type { CanvasColor, CanvasData } from "../src/types";

interface VNode {
  type: unknown;
  props: Record<string, unknown> & { children?: unknown };
}

/** Every element of a rendered vnode tree matching `test`. */
function findAll(node: unknown, test: (v: VNode) => boolean, out: VNode[] = []): VNode[] {
  if (Array.isArray(node)) {
    for (const child of node) findAll(child, test, out);
  } else if (node && typeof node === "object" && "props" in node) {
    const vnode = node as VNode;
    if (test(vnode)) out.push(vnode);
    findAll(vnode.props.children, test, out);
  }
  return out;
}

const render = (canvasData: CanvasData) =>
  CanvasBody()({
    fileData: { slug: "c.canvas", canvasData } as unknown as QuartzPluginData,
    allFiles: [],
    cfg: {},
  } as never);

const byClass = (tree: unknown, cls: string) =>
  findAll(tree, (v) => typeof v.props.class === "string" && v.props.class.split(" ").includes(cls));

const text = (id: string, x: number, y: number, width = 100, height = 50) => ({
  id,
  type: "text" as const,
  x,
  y,
  width,
  height,
  text: id,
});

/** The edge's `<path>` (the curve, not the arrow heads in its markers). */
const edgePath = (tree: unknown, id: string) => {
  const [edge] = findAll(tree, (v) => v.props["data-edge-id"] === id);
  if (!edge) return undefined;
  return findAll(edge, (v) => v.type === "path" && v.props.fill === "none")[0]!.props;
};

describe("canvas layout", () => {
  it("sizes the viewport to the nodes, 50px of padding around them", () => {
    const tree = render({
      nodes: [text("a", -100, -40, 100, 50), text("b", 200, 300, 150, 60)],
      edges: [],
    });
    const [viewport] = byClass(tree, "canvas-viewport");
    // x: -100 … 350, y: -40 … 360
    expect(viewport!.props.style).toBe("width:550px;height:500px");
    expect(byClass(tree, "canvas-nodes")[0]!.props.style).toBe("transform:translate(150px,90px)");
    const [svg] = byClass(tree, "canvas-edges");
    expect(svg!.props).toMatchObject({ width: 550, height: 500, viewBox: "-150 -90 550 500" });
  });

  it("gives an empty canvas a small viewport", () => {
    const tree = render({ nodes: [], edges: [] });
    expect(byClass(tree, "canvas-viewport")[0]!.props.style).toBe("width:200px;height:200px");
  });

  it("places and sizes each node, in its colour", () => {
    const tree = render({
      nodes: [
        { ...text("a", 10, 20, 30, 40), color: "4" },
        { ...text("b", 0, 0), color: "#123456" },
        { ...text("c", 0, 0), color: "9" as never },
      ],
      edges: [],
    });
    const styles = findAll(tree, (v) => typeof v.props["data-node-id"] === "string").map(
      (v) => v.props.style,
    );
    expect(styles).toEqual([
      "left:10px;top:20px;width:30px;height:40px;--canvas-node-color:#44cf6e",
      "left:0px;top:0px;width:100px;height:50px;--canvas-node-color:#123456",
      // not a preset colour: the default
      "left:0px;top:0px;width:100px;height:50px",
    ]);
  });

  it("labels a group", () => {
    const group = { id: "g", type: "group" as const, x: 0, y: 0, width: 10, height: 10 };
    const labelled = render({ nodes: [{ ...group, label: "Ideas" }], edges: [] });
    expect(byClass(labelled, "canvas-group-label")[0]!.props.children).toBe("Ideas");
    expect(byClass(render({ nodes: [group], edges: [] }), "canvas-group-label")).toEqual([]);
  });
});

describe("canvas edges", () => {
  // a: 0…100 × 0…50, b: 300…400 × 200…250
  const nodes = [text("a", 0, 0), text("b", 300, 200)];

  it("joins the sides it names, just outside the nodes' borders", () => {
    const sides = (fromSide: string, toSide: string) =>
      edgePath(
        render({
          nodes,
          edges: [{ id: "e", fromNode: "a", toNode: "b", fromSide, toSide } as never],
        }),
        "e",
      )!.d;
    // from (100+2, 25) to (300-2, 225): a curve through the midpoint
    expect(sides("right", "left")).toBe("M 102 25 Q 200 25, 200 125 T 298 225");
    // from (50, 50+2) to (350, 200-2)
    expect(sides("bottom", "top")).toBe("M 50 52 Q 200 52, 200 125 T 350 198");
    // from (50, -2) to (400+2, 225)
    expect(sides("top", "right")).toBe("M 50 -2 Q 226 -2, 226 111.5 T 402 225");
    // from (-2, 25) to (350, 250+2)
    expect(sides("left", "bottom")).toBe("M -2 25 Q 174 25, 174 138.5 T 350 252");
  });

  it("joins the centres of nodes without sides", () => {
    const tree = render({ nodes, edges: [{ id: "e", fromNode: "a", toNode: "b" }] });
    expect(edgePath(tree, "e")!.d).toBe("M 50 25 Q 200 25, 200 125 T 350 225");
  });

  it("draws an arrow at the end only, unless the ends say otherwise", () => {
    const ends = (edge: Record<string, unknown>) => {
      const tree = render({
        nodes,
        edges: [{ id: "e", fromNode: "a", toNode: "b", ...edge } as never],
      });
      const path = edgePath(tree, "e")!;
      const markers = findAll(tree, (v) => v.type === "marker").map((v) => v.props.id);
      return { start: path["marker-start"], end: path["marker-end"], markers };
    };
    expect(ends({})).toEqual({ start: undefined, end: "url(#arrow-e)", markers: ["arrow-e"] });
    expect(ends({ fromEnd: "arrow", toEnd: "none" })).toEqual({
      start: "url(#arrow-start-e)",
      end: undefined,
      markers: ["arrow-start-e"],
    });
    expect(ends({ fromEnd: "arrow", toEnd: "arrow" }).markers).toEqual([
      "arrow-e",
      "arrow-start-e",
    ]);
    expect(ends({ fromEnd: "none", toEnd: "none" }).markers).toEqual([]);
  });

  it("colours the line and its arrows", () => {
    const colours = (color?: CanvasColor) => {
      const tree = render({
        nodes,
        edges: [{ id: "e", fromNode: "a", toNode: "b", fromEnd: "arrow", color }],
      });
      const heads = findAll(
        findAll(tree, (v) => v.type === "marker"),
        (v) => v.type === "path",
      );
      return [edgePath(tree, "e")!.stroke, ...heads.map((v) => v.props.fill)];
    };
    expect(colours("1")).toEqual(["#fb464c", "#fb464c", "#fb464c"]);
    expect(colours("#00ff00")).toEqual(["#00ff00", "#00ff00", "#00ff00"]);
    expect(colours(undefined)).toEqual(Array(3).fill("var(--darkgray)"));
  });

  it("leaves out an edge to a node that doesn't exist", () => {
    const tree = render({
      nodes,
      edges: [
        { id: "to-missing", fromNode: "a", toNode: "x" },
        { id: "from-missing", fromNode: "x", toNode: "b" },
        { id: "ok", fromNode: "a", toNode: "b" },
      ],
    });
    expect(
      findAll(tree, (v) => v.props.class === "canvas-edge").map((v) => v.props["data-edge-id"]),
    ).toEqual(["ok"]);
  });

  it("centres its label on the curve's midpoint", () => {
    const tree = render({
      nodes,
      edges: [{ id: "e", fromNode: "a", toNode: "b", label: "depends on" }],
    });
    const [rect] = findAll(tree, (v) => v.type === "rect");
    const [label] = byClass(tree, "canvas-edge-label");
    expect(label!.props).toMatchObject({ x: 200, y: 125, children: "depends on" });
    const { x, y, width, height } = rect!.props as Record<"x" | "y" | "width" | "height", number>;
    expect(x + width / 2).toBe(200);
    expect(width).toBeGreaterThan(10 * 6);
    // above the midpoint, around the text (raised by dy=-8)
    expect(y).toBe(105);
    expect(height).toBe(16);
    expect(
      findAll(
        render({ nodes, edges: [{ id: "e", fromNode: "a", toNode: "b" }] }),
        (v) => v.type === "rect",
      ),
    ).toEqual([]);
  });
});
