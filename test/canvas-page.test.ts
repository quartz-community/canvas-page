import { describe, it, expect, vi } from "vitest";
import { createCtx } from "./helpers";
import { CanvasPage, createSiteTextRenderer, renderCanvasText } from "../src/pageType";
import type { CanvasData } from "../src/types";
import type {
  ProcessedContent,
  FullSlug,
  FilePath,
  QuartzPluginData,
} from "@quartz-community/types";
import type { Root as HastRoot } from "hast";
import CanvasBody, { resolveEmbeddedHtml } from "../src/components/CanvasBody";
import { toHtml } from "hast-util-to-html";
import { slugifyFilePath } from "@quartz-community/utils/path";

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

  it("generates virtual pages from .canvas files", async () => {
    const ctx = createCtx({
      allFiles: ["notes/project.canvas" as FilePath, "readme.md" as FilePath],
    });

    const content: ProcessedContent[] = [];
    const cfg = ctx.cfg.configuration;

    const pages = await plugin.generate!({ content, cfg, ctx });

    expect(pages).toHaveLength(1);
    expect(pages[0]!.slug).toBe("notes/project.canvas");
    expect(pages[0]!.title).toBe("project");
    expect(pages[0]!.data).toHaveProperty("canvasData");
  });

  it("gives virtual pages the .canvas file's source paths", async () => {
    const ctx = createCtx({
      allFiles: ["maps/Team Board.canvas" as FilePath, "Root.canvas" as FilePath],
    });

    const pages = await plugin.generate!({ content: [], cfg: ctx.cfg.configuration, ctx });

    expect(pages.map((p) => [p.data.filePath, p.data.relativePath])).toEqual([
      ["content/maps/Team Board.canvas", "maps/Team Board.canvas"],
      ["content/Root.canvas", "Root.canvas"],
    ]);
  });

  it("keeps the .canvas extension in virtual page slugs", async () => {
    const ctx = createCtx({
      allFiles: ["maps/Team Board.canvas" as FilePath],
    });

    const content: ProcessedContent[] = [];
    const cfg = ctx.cfg.configuration;

    const pages = await plugin.generate!({ content, cfg, ctx });

    expect(pages).toHaveLength(1);
    expect(pages[0]!.slug).toBe("maps/team-board.canvas");
    expect(pages[0]!.slug.endsWith(".canvas")).toBe(true);
  });

  it("normalizes spaces to hyphens and lowercases canvas slugs", async () => {
    const ctx = createCtx({
      allFiles: ["Study Notes/Concept Civic Board.canvas" as FilePath],
    });

    const content: ProcessedContent[] = [];
    const cfg = ctx.cfg.configuration;

    const pages = await plugin.generate!({ content, cfg, ctx });

    expect(pages).toHaveLength(1);
    expect(pages[0]!.slug).toBe("study-notes/concept-civic-board.canvas");
    expect(pages[0]!.title).toBe("Concept Civic Board");
  });

  describe("embedded content resolution", () => {
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

    it("rebases relative hrefs inside embedded htmlAst to the canvas page's slug", () => {
      const canvasSlug = "canvas.canvas" as FullSlug;
      const sourceSlug = "plugins/canvaspage" as FullSlug;
      const allFiles: QuartzPluginData[] = [
        {
          slug: sourceSlug,
          htmlAst: buildHtmlAstWithRelativeLink("../layout"),
        } as unknown as QuartzPluginData,
      ];

      const embedded = resolveEmbeddedHtml(sourceSlug, canvasSlug, allFiles);
      expect(embedded).toBeTruthy();

      const m = embedded!.match(/href="([^"]+)"/);
      expect(m).toBeTruthy();
      const href = m![1]!;
      const resolved = new URL(href, `https://example.com/${canvasSlug}`).pathname;
      expect(resolved).toBe("/layout");
    });

    it("leaves absolute URLs in embedded htmlAst untouched", () => {
      const canvasSlug = "canvas.canvas" as FullSlug;
      const sourceSlug = "plugins/canvaspage" as FullSlug;
      const allFiles: QuartzPluginData[] = [
        {
          slug: sourceSlug,
          htmlAst: buildHtmlAstWithRelativeLink("https://example.com/external"),
        } as unknown as QuartzPluginData,
      ];

      const embedded = resolveEmbeddedHtml(sourceSlug, canvasSlug, allFiles);
      expect(embedded).toContain('href="https://example.com/external"');
    });

    it("resolves virtual pages by stripping file extension from slug", () => {
      const canvasSlug = "canvas.canvas" as FullSlug;
      const fileSlug = "untitled.base" as FullSlug;
      const allFiles: QuartzPluginData[] = [
        {
          slug: "untitled" as FullSlug,
          htmlAst: buildHtmlAstWithRelativeLink("./other"),
        } as unknown as QuartzPluginData,
      ];

      const embedded = resolveEmbeddedHtml(fileSlug, canvasSlug, allFiles);
      expect(embedded).toBeTruthy();
      expect(embedded).toContain("other");
    });

    it("returns undefined when page is not found", () => {
      const embedded = resolveEmbeddedHtml(
        "nonexistent" as FullSlug,
        "canvas.canvas" as FullSlug,
        [],
      );
      expect(embedded).toBeUndefined();
    });

    it("returns undefined when page has no htmlAst", () => {
      const allFiles: QuartzPluginData[] = [
        { slug: "test" as FullSlug } as unknown as QuartzPluginData,
      ];
      const embedded = resolveEmbeddedHtml(
        "test" as FullSlug,
        "canvas.canvas" as FullSlug,
        allFiles,
      );
      expect(embedded).toBeUndefined();
    });

    it("returns undefined for circular embed (self-reference)", () => {
      const canvasSlug = "my.canvas" as FullSlug;
      const allFiles: QuartzPluginData[] = [
        {
          slug: canvasSlug,
          htmlAst: buildHtmlAstWithRelativeLink("./test"),
        } as unknown as QuartzPluginData,
      ];
      const visited = new Set<string>([canvasSlug]);
      const embedded = resolveEmbeddedHtml(canvasSlug, canvasSlug, allFiles, undefined, visited);
      expect(embedded).toBeUndefined();
    });

    it("returns undefined when visited set blocks a canvas-in-canvas cycle", () => {
      const canvasA = "a.canvas" as FullSlug;
      const canvasB = "b.canvas" as FullSlug;
      const allFiles: QuartzPluginData[] = [
        {
          slug: canvasB,
          htmlAst: buildHtmlAstWithRelativeLink("./x"),
        } as unknown as QuartzPluginData,
      ];
      const visited = new Set<string>([canvasA, canvasB]);
      const embedded = resolveEmbeddedHtml(canvasB, canvasA, allFiles, undefined, visited);
      expect(embedded).toBeUndefined();
    });

    it("extracts header section via #heading subpath", () => {
      const htmlAst: HastRoot = {
        type: "root",
        children: [
          {
            type: "element",
            tagName: "h2",
            properties: { id: "intro" },
            children: [{ type: "text", value: "Intro" }],
          },
          {
            type: "element",
            tagName: "p",
            properties: {},
            children: [{ type: "text", value: "Intro content" }],
          },
          {
            type: "element",
            tagName: "h2",
            properties: { id: "details" },
            children: [{ type: "text", value: "Details" }],
          },
          {
            type: "element",
            tagName: "p",
            properties: {},
            children: [{ type: "text", value: "Details content" }],
          },
        ],
      };

      const allFiles: QuartzPluginData[] = [
        { slug: "doc" as FullSlug, htmlAst } as unknown as QuartzPluginData,
      ];

      const embedded = resolveEmbeddedHtml(
        "doc" as FullSlug,
        "canvas.canvas" as FullSlug,
        allFiles,
        "#intro",
      );
      expect(embedded).toBeTruthy();
      expect(embedded).toContain("Intro content");
      expect(embedded).not.toContain("Details content");
    });

    it("extracts a header section inside Obsidian's block wrappers", () => {
      const wrap = (tagName: string, id: string | undefined, value: string) => ({
        type: "element" as const,
        tagName: "div",
        properties: { className: [`el-${tagName}`] },
        children: [
          {
            type: "element" as const,
            tagName,
            properties: id ? { id } : {},
            children: [{ type: "text" as const, value }],
          },
        ],
      });
      const htmlAst: HastRoot = {
        type: "root",
        children: [
          wrap("h2", "intro", "Intro"),
          wrap("p", undefined, "Intro content"),
          wrap("h2", "details", "Details"),
          wrap("p", undefined, "Details content"),
        ],
      };
      const allFiles: QuartzPluginData[] = [
        { slug: "doc" as FullSlug, htmlAst } as unknown as QuartzPluginData,
      ];

      const embedded = resolveEmbeddedHtml(
        "doc" as FullSlug,
        "canvas.canvas" as FullSlug,
        allFiles,
        "#intro",
      );
      expect(embedded).toContain('<div class="el-p"><p>Intro content</p></div>');
      expect(embedded).not.toContain("Details content");
    });

    it("extracts block via #^blockid subpath", () => {
      const htmlAst: HastRoot = { type: "root", children: [] };
      const blocks: Record<string, import("hast").Element> = {
        myblock: {
          type: "element",
          tagName: "p",
          properties: {},
          children: [{ type: "text", value: "Block content here" }],
        },
      };

      const allFiles: QuartzPluginData[] = [
        { slug: "doc" as FullSlug, htmlAst, blocks } as unknown as QuartzPluginData,
      ];

      const embedded = resolveEmbeddedHtml(
        "doc" as FullSlug,
        "canvas.canvas" as FullSlug,
        allFiles,
        "#^myblock",
      );
      expect(embedded).toBeTruthy();
      expect(embedded).toContain("Block content here");
    });

    it("filters bases view via #view-name subpath", () => {
      const htmlAst: HastRoot = {
        type: "root",
        children: [
          {
            type: "element",
            tagName: "div",
            properties: { className: ["bases-view-container"] },
            children: [
              {
                type: "element",
                tagName: "div",
                properties: { className: ["bases-view"], dataViewType: "table" },
                children: [{ type: "text", value: "Table view" }],
              },
              {
                type: "element",
                tagName: "div",
                properties: { className: ["bases-view"], dataViewType: "list" },
                children: [{ type: "text", value: "List view" }],
              },
            ],
          },
        ],
      };

      const allFiles: QuartzPluginData[] = [
        { slug: "mybase" as FullSlug, htmlAst, basesData: {} } as unknown as QuartzPluginData,
      ];

      const embedded = resolveEmbeddedHtml(
        "mybase" as FullSlug,
        "canvas.canvas" as FullSlug,
        allFiles,
        "#list",
      );
      expect(embedded).toBeTruthy();
      expect(embedded).toContain("List view");
      expect(embedded).not.toContain("Table view");
    });

    it("returns undefined for non-existent heading subpath", () => {
      const htmlAst: HastRoot = {
        type: "root",
        children: [
          {
            type: "element",
            tagName: "h2",
            properties: { id: "intro" },
            children: [{ type: "text", value: "Intro" }],
          },
        ],
      };

      const allFiles: QuartzPluginData[] = [
        { slug: "doc" as FullSlug, htmlAst } as unknown as QuartzPluginData,
      ];

      const embedded = resolveEmbeddedHtml(
        "doc" as FullSlug,
        "canvas.canvas" as FullSlug,
        allFiles,
        "#nonexistent",
      );
      expect(embedded).toBeUndefined();
    });

    it("returns undefined for non-existent bases view subpath", () => {
      const htmlAst: HastRoot = {
        type: "root",
        children: [
          {
            type: "element",
            tagName: "div",
            properties: { className: ["bases-view-container"] },
            children: [
              {
                type: "element",
                tagName: "div",
                properties: { className: ["bases-view"], dataViewType: "table" },
                children: [{ type: "text", value: "Table view" }],
              },
            ],
          },
        ],
      };

      const allFiles: QuartzPluginData[] = [
        { slug: "mybase" as FullSlug, htmlAst, basesData: {} } as unknown as QuartzPluginData,
      ];

      const embedded = resolveEmbeddedHtml(
        "mybase" as FullSlug,
        "canvas.canvas" as FullSlug,
        allFiles,
        "#gallery",
      );
      expect(embedded).toBeUndefined();
    });
  });
});

describe("renderCanvasText link resolution", () => {
  const allSlugs = ["index.md", "Note.md", "sub/Other Note.md", "board.canvas"].map((fp) =>
    slugifyFilePath(fp as FilePath),
  );
  const render = (text: string, slug = "board.canvas") =>
    renderCanvasText(text, slug as FullSlug, allSlugs);

  it("resolves markdown links to .md files against site slugs", () => {
    const html = render("[Note](Note.md) and [Other](sub/Other%20Note.md)");
    expect(html).toContain('href="./note"');
    expect(html).toContain('href="./sub/other-note"');
    expect(html).not.toContain(".md");
  });

  it("resolves by shortest path and relative to nested canvas pages", () => {
    const html = render("[x](Other%20Note.md)", "deep/dir/board.canvas");
    expect(html).toContain('href="../../sub/other-note"');
  });

  it("turns wikilinks into links, with aliases and headings", () => {
    const html = render("[[Note]] [[Other Note|shown]] [[Note#My Heading]]");
    expect(html).toContain('<a href="./note" class="internal internal-link">Note</a>');
    expect(html).toContain('<a href="./sub/other-note" class="internal internal-link">shown</a>');
    expect(html).toContain(
      'href="./note#my-heading" class="internal internal-link">Note &gt; My Heading</a>',
    );
  });

  it("leaves external links, anchors and embeds untouched", () => {
    const html = render("[ext](https://example.com) [a](#top) ![[image.png]]");
    expect(html).toContain('<a href="https://example.com">ext</a>');
    expect(html).toContain('<a href="#top">a</a>');
    expect(html).toContain("![[image.png]]");
  });
});

describe("text nodes rendered with the site's Markdown plugins", () => {
  const plugin = CanvasPage();
  // a stand-in for ofm's Mermaid handling: ```mermaid -> <div class="mermaid">
  const mermaidTransformer = {
    name: "FakeMermaid",
    textTransform: (_ctx: unknown, src: string) => src.replace("{{name}}", "World"),
    markdownPlugins: () => [
      () => (tree: { children: Array<{ type: string; lang?: string; value?: string }> }) => {
        tree.children = tree.children.map((n) =>
          n.type === "code" && n.lang === "mermaid"
            ? ({
                type: "mermaidDiagram",
                data: { hName: "div", hProperties: { className: ["mermaid"] } },
                children: [{ type: "text", value: n.value }],
              } as never)
            : n,
        );
      },
    ],
    htmlPlugins: () => [],
  };

  const makeCtx = (transformers: unknown[]) =>
    createCtx({ cfg: { configuration: {}, plugins: { transformers } } as never });

  it("runs textTransform, markdownPlugins and htmlPlugins", async () => {
    const render = createSiteTextRenderer(makeCtx([mermaidTransformer]))!;
    const { tree } = await render("Hello {{name}}\n\n```mermaid\ngraph TD\nA-->B\n```", {
      slug: "board.canvas" as FullSlug,
      filePath: "content/board.canvas" as FilePath,
      relativePath: "board.canvas" as FilePath,
    });
    const html = toHtml(tree);
    expect(html).toContain("<p>Hello World</p>");
    expect(html).toMatch(/<div class="mermaid">graph TD\nA--(>|&#x3E;|&gt;)B<\/div>/);
  });

  it("is not used without transformers (basic rendering)", () => {
    expect(createSiteTextRenderer(createCtx())).toBeUndefined();
  });

  it("falls back to basic Markdown when a site plugin throws", async () => {
    const broken = {
      name: "Broken",
      markdownPlugins: () => [
        () => () => {
          throw new Error("boom");
        },
      ],
    };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const ctx = makeCtx([broken]);
    ctx.allFiles = ["b.canvas" as FilePath];
    const pages = await plugin.generate!({ content: [], cfg: ctx.cfg.configuration, ctx });
    const data = pages[0]!.data.canvasData as { renderedTexts: Record<string, string> };
    // the mocked file is sampleCanvas: its text node gets the basic renderer's output
    const textNode = sampleCanvas.nodes!.find((n) => n.type === "text")!;
    expect(data.renderedTexts[textNode.id]).toBe(
      renderCanvasText(textNode.text!, "b.canvas" as FullSlug, []),
    );
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

const el = (
  tagName: string,
  properties: Record<string, unknown> = {},
  children: HastRoot["children"] = [],
) => ({ type: "element" as const, tagName, properties, children }) as HastRoot["children"][number];
const text = (value: string) => ({ type: "text" as const, value });

/** The HTML CanvasBody renders into each node's content, by node id. */
function renderedNodeHtml(
  canvasData: Record<string, unknown>,
  allFiles: QuartzPluginData[],
  slug = "board.canvas",
): Record<string, string> {
  const Body = CanvasBody();
  const vnode = Body({
    fileData: { slug, canvasData } as unknown as QuartzPluginData,
    allFiles,
    cfg: {},
  } as never) as unknown;
  const out: Record<string, string> = {};
  const walk = (node: unknown, nodeId?: string) => {
    if (Array.isArray(node)) return node.forEach((n) => walk(n, nodeId));
    if (!node || typeof node !== "object") return;
    const props = (node as { props?: Record<string, unknown> }).props ?? {};
    const id = (props["data-node-id"] as string | undefined) ?? nodeId;
    const inner = props.dangerouslySetInnerHTML as { __html: string } | undefined;
    if (inner && id) out[id] = inner.__html;
    walk(props.children, id);
  };
  walk(vnode);
  return out;
}

describe("file nodes with a heading subpath (Obsidian stores the heading's text)", () => {
  const doc: HastRoot = {
    type: "root",
    children: [
      el("div", { className: ["el-h2"] }, [
        el("h2", { id: "sub-section", dataHeading: "Sub Section" }, [text("Sub Section")]),
      ]),
      el("div", { className: ["el-p"] }, [el("p", {}, [text("Body of sub section.")])]),
      el("div", { className: ["el-h3"] }, [
        // with `slugs.stripDiacritics` the id has no accents, the subpath does
        el("h3", { id: "ca-va", dataHeading: "Ça va" }, [text("Ça va")]),
      ]),
      el("p", {}, [text("accent body.")]),
      el("h2", { id: "colon-unspaced" }, [
        text("Colon:unspaced"),
        el("a", { role: "anchor", href: "#colon-unspaced" }, [text("#")]),
      ]),
      el("p", {}, [text("colon body.")]),
      el("h2", { id: "other" }, [text("Other")]),
      el("p", {}, [text("Other body.")]),
    ],
  };
  const allFiles = [{ slug: "doc", htmlAst: doc } as unknown as QuartzPluginData];
  const embed = (subpath: string) =>
    resolveEmbeddedHtml("doc" as FullSlug, "board.canvas" as FullSlug, allFiles, subpath);

  it("finds the heading by its text, inside block wrappers", () => {
    const html = embed("#Sub Section");
    expect(html).toContain("Body of sub section.");
    expect(html).not.toContain("Other body.");
  });

  it("finds a heading with accents, also when its id was stripped of them", () => {
    const html = embed("#Ça va");
    expect(html).toContain("accent body.");
    expect(html).not.toContain("Other body.");
  });

  it("finds a heading by the anchor Obsidian writes for it, and still by its id", () => {
    expect(embed("#Colon unspaced")).toContain("colon body.");
    expect(embed("#other")).toContain("Other body.");
  });
});

describe("text node tags", () => {
  it("are the canvas page's tags, so tag pages are built for them", async () => {
    // a stand-in for ofm's tag parsing: records `#tag` in the note's frontmatter
    const tagTransformer = {
      name: "FakeTags",
      markdownPlugins: () => [
        () => (_tree: unknown, file: { data: { frontmatter?: { tags?: string[] } } }) => {
          file.data.frontmatter!.tags = [...(file.data.frontmatter!.tags ?? []), "canvastag"];
        },
      ],
    };
    const ctx = createCtx({
      cfg: { configuration: {}, plugins: { transformers: [tagTransformer] } } as never,
    });
    ctx.allFiles = ["b.canvas" as FilePath];
    const pages = await CanvasPage().generate!({ content: [], cfg: ctx.cfg.configuration, ctx });
    expect(pages[0]!.data.frontmatter).toEqual({ title: "b", tags: ["canvastag"] });
  });
});

describe("text node content on the canvas page", () => {
  const doc: HastRoot = {
    type: "root",
    children: [
      el("h1", { id: "doc" }, [text("Doc")]),
      el("h2", { id: "other", dataHeading: "Other" }, [text("Other")]),
      el("p", {}, [text("Other body."), el("a", { href: "./x" }, [text("x")])]),
    ],
  };
  const creme: HastRoot = { type: "root", children: [el("p", {}, [text("Crème body.")])] };
  const allFiles = [
    { slug: "doc", htmlAst: doc, frontmatter: { title: "Doc" } },
    { slug: "cafe/creme-brulee", htmlAst: creme, frontmatter: { title: "Crème brûlée" } },
    { slug: "board.canvas", frontmatter: { title: "board" } },
  ] as unknown as QuartzPluginData[];

  const transclude = (slug: string, block = "") =>
    el("div", { className: ["transclude", "internal-embed"], dataUrl: slug, dataBlock: block }, [
      el("a", { href: `./${slug}${block}`, className: ["transclude-inner"], dataSlug: slug }, [
        text(`Transclude of ${slug}${block}`),
      ]),
    ]);
  // what the site's Markdown plugins render for "# Same\nfootnote[^1] …\n\n[^1]: one"
  const footnoted = (extra: HastRoot["children"]): HastRoot => ({
    type: "root",
    children: [
      el("h1", { id: "same" }, [text("Same")]),
      el("p", {}, [
        text("footnote"),
        el("sup", {}, [
          el(
            "a",
            {
              href: "#user-content-fn-1",
              id: "user-content-fnref-1",
              dataFootnoteRef: "",
              ariaDescribedBy: "footnote-label",
            },
            [text("1")],
          ),
        ]),
        el("a", { href: "#same" }, [text("self")]),
      ]),
      ...extra,
      el("section", { dataFootnotes: "", className: ["footnotes"] }, [
        el("h2", { id: "footnote-label" }, [text("Footnotes")]),
        el("ol", {}, [el("li", { id: "user-content-fn-1" }, [text("note")])]),
      ]),
    ],
  });

  const canvasData = (trees: Record<string, HastRoot>) => ({
    nodes: Object.keys(trees).map((id, i) => ({
      id,
      type: "text",
      text: "…",
      x: i * 300,
      y: 0,
      width: 200,
      height: 100,
    })),
    edges: [],
    renderedTrees: trees,
  });

  it("renders embeds as Quartz does on a note, without empty paragraphs around them", () => {
    const html = renderedNodeHtml(
      canvasData({
        t1: {
          type: "root",
          children: [
            el("div", { className: ["el-p"] }, [el("p", {}, [])]),
            transclude("doc", "#other"),
            el("p", {}, [text(" ")]),
            transclude("cafe/creme-brulee"),
          ],
        },
      }),
      allFiles,
    ).t1!;
    expect(html).not.toContain("Transclude of");
    expect(html).toContain("Other body.");
    expect(html).not.toContain(">Doc<");
    expect(html).toContain('class="embed-title markdown-embed-title">Crème brûlée</div>');
    expect(html).toContain("Crème body.");
    expect(html).toContain("transclude-src");
    expect(html).not.toMatch(/<p>\s*<\/p>/);
  });

  it("cuts circular embeds (the canvas embedding itself)", () => {
    const html = renderedNodeHtml(
      canvasData({ t1: { type: "root", children: [transclude("board.canvas")] } }),
      allFiles,
    ).t1!;
    expect(html).toContain("Circular transclusion detected: board.canvas");
  });

  it("gives each text node's ids a prefix of its own and points its links at them", () => {
    const html = renderedNodeHtml(
      canvasData({ t1: footnoted([]), t2: footnoted([transclude("doc", "#other")]) }),
      allFiles,
    );
    const ids = Object.values(html).flatMap((h) =>
      [...h.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]),
    );
    expect(new Set(ids).size).toBe(ids.length);
    for (const [nodeId, h] of Object.entries(html)) {
      expect(h).toContain(`id="node-${nodeId}--same"`);
      expect(h).toContain(`href="#node-${nodeId}--same"`);
      expect(h).toContain(`href="#node-${nodeId}--user-content-fn-1"`);
      expect(h).toContain(`id="node-${nodeId}--user-content-fn-1"`);
      expect(h).toContain(`aria-describedby="node-${nodeId}--footnote-label"`);
    }
    // the embedded heading section's ids are scoped twice: by its node and its embed
    expect(html.t2).toContain('id="node-t2--doc--other"');
  });

  it("scopes the ids of text nodes rendered with basic Markdown too", () => {
    const md = "# Same\n\nfootnote[^1]\n\n[^1]: one";
    const renderedTexts = {
      b1: renderCanvasText(md, "board.canvas" as FullSlug, []),
      b2: renderCanvasText(md, "board.canvas" as FullSlug, []),
    };
    const data = {
      ...canvasData({}),
      nodes: canvasData({ b1: footnoted([]), b2: footnoted([]) }).nodes,
      renderedTexts,
    };
    const html = renderedNodeHtml(data, allFiles);
    const ids = Object.values(html).flatMap((h) =>
      [...h.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]),
    );
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    for (const [nodeId, h] of Object.entries(html)) {
      expect(h).toContain(`href="#node-${nodeId}--user-content-fn-1"`);
      expect(h).toContain(`id="node-${nodeId}--user-content-fn-1"`);
      expect(h).toContain(`href="#node-${nodeId}--user-content-fnref-1"`);
      expect(h).toContain(`aria-describedby="node-${nodeId}--footnote-label"`);
    }
  });

  it("fills the embeds inside a file node's note and scopes its ids", () => {
    const withEmbed: HastRoot = {
      type: "root",
      children: [el("h2", { id: "intro" }, [text("Intro")]), transclude("doc", "#other")],
    };
    const files = [
      ...allFiles,
      { slug: "host", htmlAst: withEmbed, frontmatter: { title: "Host" } },
    ] as unknown as QuartzPluginData[];
    const data = {
      nodes: ["f1", "f2"].map((id, i) => ({
        id,
        type: "file",
        file: "host.md",
        x: i * 300,
        y: 0,
        width: 200,
        height: 100,
      })),
      edges: [],
    };
    const html = renderedNodeHtml(data, files);
    expect(html.f1).toContain("Other body.");
    expect(html.f1).toContain('id="node-f1--intro"');
    expect(html.f2).toContain('id="node-f2--intro"');
  });
});
