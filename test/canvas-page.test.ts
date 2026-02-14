import { describe, it, expect, vi } from "vitest";
import { createCtx } from "./helpers";
import { CanvasPage } from "../src/pageType";
import type { CanvasData } from "../src/types";
import type { ProcessedContent, FullSlug, FilePath } from "@quartz-community/types";

const sampleCanvas: CanvasData = {
  nodes: [
    { id: "1", type: "text", x: 0, y: 0, width: 200, height: 100, text: "Hello" },
    { id: "2", type: "file", x: 300, y: 0, width: 200, height: 100, file: "notes/test.md" },
  ],
  edges: [{ id: "e1", fromNode: "1", toNode: "2", toEnd: "arrow" }],
};

vi.mock("fs", () => ({
  readFileSync: vi.fn(() => JSON.stringify(sampleCanvas)),
}));

describe("CanvasPage", () => {
  const plugin = CanvasPage();

  it("has correct name and layout", () => {
    expect(plugin.name).toBe("CanvasPage");
    expect(plugin.layout).toBe("canvas");
    expect(plugin.priority).toBe(20);
  });

  it("matches pages with canvasData in fileData", () => {
    const cfg = {} as Parameters<typeof plugin.match>[0]["cfg"];
    const withCanvas = { canvasData: sampleCanvas } as Parameters<
      typeof plugin.match
    >[0]["fileData"];
    const withoutCanvas = {} as Parameters<typeof plugin.match>[0]["fileData"];

    expect(plugin.match({ slug: "my-canvas" as FullSlug, fileData: withCanvas, cfg })).toBe(true);
    expect(plugin.match({ slug: "regular-page" as FullSlug, fileData: withoutCanvas, cfg })).toBe(
      false,
    );
  });

  it("declares .canvas fileExtensions", () => {
    expect(plugin.fileExtensions).toEqual([".canvas"]);
  });

  it("generates virtual pages from .canvas files", () => {
    const ctx = createCtx({
      allFiles: ["notes/project.canvas" as FilePath, "readme.md" as FilePath],
    });

    const content: ProcessedContent[] = [];
    const cfg = ctx.cfg.configuration;

    const pages = plugin.generate!({ content, cfg, ctx });

    expect(pages).toHaveLength(1);
    expect(pages[0]!.slug).toBe("notes/project");
    expect(pages[0]!.title).toBe("project");
    expect(pages[0]!.data).toHaveProperty("canvasData");
  });
});
