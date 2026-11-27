import { describe, expect, it } from "vitest";
import { autoSide, edgeGeometry } from "../src/components/edgePath";

// Paths recorded in Obsidian 1.15.1 (dev-mode obsidian-bases-probe, canvas.edges[…].path.display).
// Obsidian draws the 7px stub as its own subpath and the arrowhead over the last stub; here the
// path runs border to border, so the numbers below are Obsidian's stub ends and control points.
const box = (x: number, y: number, width = 200, height = 100) => ({ x, y, width, height });
const nums = (d: string) => d.match(/-?\d+(\.\d+)?/g)!.map(Number);

describe("edge paths (Obsidian parity)", () => {
  it.each([
    // [from, to, fromSide, toSide, Obsidian's "sx,sy C c1 c2 ex,ey"]
    [box(0, 0), box(500, 300), "right", "left", [207, 50, 357, 50, 343, 350, 493, 350]],
    [box(0, 0), box(0, 700), "bottom", "top", [100, 107, 100, 257, 100, 543, 100, 693]],
    [box(500, 300), box(900, 0), "top", "bottom", [600, 293, 600, 143, 1000, 257, 1000, 107]],
    [box(0, 0), box(900, 0), "right", "right", [207, 50, 357, 50, 1257, 50, 1107, 50]],
    [box(500, 300), box(0, 700), "bottom", "left", [600, 407, 600, 557, -157, 750, -7, 750]],
    [box(900, 0), box(1000, 40), "right", "left", [1107, 50, 1177, 50, 923, 90, 993, 90]],
  ] as const)("%o → %o (%s to %s)", (from, to, fromSide, toSide, expected) => {
    const n = nums(edgeGeometry(from, to, fromSide, toSide).d);
    // M border, L stub end, C c1, c2, stub end, L border
    expect(n.slice(2, 10)).toEqual(expected);
  });

  it("starts and ends on the border, so the arrow points into the side", () => {
    const n = nums(edgeGeometry(box(0, 0), box(500, 300), "right", "left").d);
    expect(n.slice(0, 2)).toEqual([200, 50]);
    expect(n.slice(-2)).toEqual([500, 350]);
  });

  it("keeps the control distance at half the stub distance, within 70 to 150", () => {
    const k = (gap: number) => {
      const n = nums(edgeGeometry(box(0, 0), box(200 + gap, 0), "right", "left").d);
      return n[4]! - n[2]!;
    };
    // Obsidian: gaps 10, 120, 160, 200, 300, 400 give 70, 70, 73, 93, 143, 150
    expect([10, 120, 160, 200, 300, 400].map(k)).toEqual([70, 70, 73, 93, 143, 150]);
  });

  it("picks each end's side from the direction to the other node, by the node's own shape", () => {
    const sides = (dx: number, dy: number, s = [200, 100], t = [200, 100]) => {
      const from = box(0, 0, s[0], s[1]);
      const to = box(dx, dy, t[0], t[1]);
      return [autoSide(from, to), autoSide(to, from)];
    };
    expect(sides(400, 0)).toEqual(["right", "left"]);
    expect(sides(-400, 0)).toEqual(["left", "right"]);
    expect(sides(0, -300)).toEqual(["top", "bottom"]);
    expect(sides(500, 300)).toEqual(["bottom", "top"]);
    expect(sides(700, 300)).toEqual(["right", "left"]);
    expect(sides(500, -320)).toEqual(["top", "bottom"]);
    expect(sides(600, 200, [400, 100], [100, 300])).toEqual(["bottom", "left"]);
    expect(sides(300, 500, [100, 300], [400, 100])).toEqual(["right", "top"]);
  });

  it("puts the label at the middle of the curve", () => {
    expect(edgeGeometry(box(0, 0), box(0, 700), "bottom", "top").mid).toEqual({ x: 100, y: 400 });
  });
});
