import { describe, it, expect, vi, beforeEach } from "vitest";
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

  it("matches .canvas slugs", () => {
    const cfg = {} as Parameters<typeof plugin.match>[0]["cfg"];
    const fileData = {} as Parameters<typeof plugin.match>[0]["fileData"];

    expect(plugin.match({ slug: "my-canvas.canvas" as FullSlug, fileData, cfg })).toBe(true);
    expect(plugin.match({ slug: "notes/project.canvas" as FullSlug, fileData, cfg })).toBe(true);
    expect(plugin.match({ slug: "regular-page" as FullSlug, fileData, cfg })).toBe(false);
    expect(plugin.match({ slug: "page.md" as FullSlug, fileData, cfg })).toBe(false);
  });

  it("generates virtual pages from .canvas files", () => {
    const ctx = createCtx({
      allFiles: ["notes/project.canvas" as FilePath, "readme.md" as FilePath],
    });

    const content: ProcessedContent[] = [];
    const cfg = ctx.cfg.configuration;

    const pages = plugin.generate!({ content, cfg, ctx });

    expect(pages).toHaveLength(1);
    expect(pages[0]!.slug).toBe("notes/project.canvas");
    expect(pages[0]!.title).toBe("project");
    expect(pages[0]!.data).toHaveProperty("canvasData");
  });
});
