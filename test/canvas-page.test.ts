import { describe, it, expect, vi } from "vitest";
import { createCtx, createProcessedContent } from "./helpers";
import { CanvasPage } from "../src/pageType";
import type { CanvasData } from "../src/types";
import type { ProcessedContent, FullSlug, FilePath } from "@quartz-community/types";
import type { Root as HastRoot } from "hast";

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
    expect(pages[0]!.slug).toBe("notes/project.canvas");
    expect(pages[0]!.title).toBe("project");
    expect(pages[0]!.data).toHaveProperty("canvasData");
  });

  it("keeps the .canvas extension in virtual page slugs", () => {
    const ctx = createCtx({
      allFiles: ["maps/Team Board.canvas" as FilePath],
    });

    const content: ProcessedContent[] = [];
    const cfg = ctx.cfg.configuration;

    const pages = plugin.generate!({ content, cfg, ctx });

    expect(pages).toHaveLength(1);
    expect(pages[0]!.slug).toBe("maps/team-board.canvas");
    expect(pages[0]!.slug.endsWith(".canvas")).toBe(true);
  });

  it("normalizes spaces to hyphens and lowercases canvas slugs", () => {
    const ctx = createCtx({
      allFiles: ["Study Notes/Concept Civic Board.canvas" as FilePath],
    });

    const content: ProcessedContent[] = [];
    const cfg = ctx.cfg.configuration;

    const pages = plugin.generate!({ content, cfg, ctx });

    expect(pages).toHaveLength(1);
    expect(pages[0]!.slug).toBe("study-notes/concept-civic-board.canvas");
    expect(pages[0]!.title).toBe("Concept Civic Board");
  });

  describe("embedded content rebasing", () => {
    const canvasWithFileNode: CanvasData = {
      nodes: [
        {
          id: "file-node",
          type: "file",
          x: 0,
          y: 0,
          width: 200,
          height: 100,
          file: "plugins/canvaspage.md",
        },
      ],
      edges: [],
    };

    const buildHtmlAstWithRelativeLink = (href: string): HastRoot => ({
      type: "root",
      children: [
        {
          type: "element",
          tagName: "p",
          properties: {},
          children: [
            {
              type: "element",
              tagName: "a",
              properties: { href },
              children: [{ type: "text", value: "link" }],
            },
          ],
        },
      ],
    });

    it("rebases relative hrefs inside embedded htmlAst to the canvas page's slug", async () => {
      vi.mocked(
        (await import("fs")).readFileSync as unknown as ReturnType<typeof vi.fn>,
      ).mockReturnValueOnce(JSON.stringify(canvasWithFileNode));

      const ctx = createCtx({
        allFiles: ["canvas.canvas" as FilePath, "plugins/CanvasPage.md" as FilePath],
      });

      const sourceSlug = "plugins/canvaspage" as FullSlug;
      const source = createProcessedContent({
        slug: sourceSlug,
        htmlAst: buildHtmlAstWithRelativeLink("../layout"),
      });

      const pages = plugin.generate!({
        content: [source],
        cfg: ctx.cfg.configuration,
        ctx,
      });

      expect(pages).toHaveLength(1);
      const embedded = (pages[0]!.data as { embeddedContent: Record<string, string> })
        .embeddedContent["file-node"]!;

      const canvasSlug = pages[0]!.slug as FullSlug;
      const m = embedded.match(/href="([^"]+)"/);
      expect(m).toBeTruthy();
      const href = m![1]!;
      const resolved = new URL(href, `https://example.com/${canvasSlug}`).pathname;
      expect(resolved).toBe("/layout");
    });

    it("leaves absolute URLs in embedded htmlAst untouched", async () => {
      vi.mocked(
        (await import("fs")).readFileSync as unknown as ReturnType<typeof vi.fn>,
      ).mockReturnValueOnce(JSON.stringify(canvasWithFileNode));

      const ctx = createCtx({
        allFiles: ["canvas.canvas" as FilePath, "plugins/CanvasPage.md" as FilePath],
      });

      const source = createProcessedContent({
        slug: "plugins/canvaspage" as FullSlug,
        htmlAst: buildHtmlAstWithRelativeLink("https://example.com/external"),
      });

      const pages = plugin.generate!({
        content: [source],
        cfg: ctx.cfg.configuration,
        ctx,
      });

      const embedded = (pages[0]!.data as { embeddedContent: Record<string, string> })
        .embeddedContent["file-node"];
      expect(embedded).toContain('href="https://example.com/external"');
    });
  });
});
