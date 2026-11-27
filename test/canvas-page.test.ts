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

    it("finds a block by its ^id written in any case (Obsidian stores it as written)", () => {
      const blocks: Record<string, import("hast").Element> = {
        "para-1": {
          type: "element",
          tagName: "p",
          properties: { id: "^para-1" },
          children: [{ type: "text", value: "The block" }],
        },
      };
      const htmlAst: HastRoot = {
        type: "root",
        children: [
          {
            type: "element",
            tagName: "h2",
            properties: { id: "para-1" },
            children: [{ type: "text", value: "Para 1" }],
          },
          blocks["para-1"]!,
        ],
      };
      const allFiles: QuartzPluginData[] = [
        { slug: "doc" as FullSlug, htmlAst, blocks } as unknown as QuartzPluginData,
      ];
      const embedded = resolveEmbeddedHtml(
        "doc" as FullSlug,
        "canvas.canvas" as FullSlug,
        allFiles,
        "#^Para-1",
      );
      expect(embedded).toContain("The block");
      expect(embedded).not.toContain("Para 1");
      expect(embedded).toContain('id="^para-1"');
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
      // GitHub's slugger drops the colon: `## Colon:unspaced` gets the id `colonunspaced`
      el("h2", { id: "colonunspaced" }, [
        text("Colon:unspaced"),
        el("a", { role: "anchor", href: "#colonunspaced" }, [text("#")]),
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
    // the h3 under it is part of the section, up to the next h2
    expect(html).toContain('<h3 id="ca-va" data-heading="Ça va">Ça va</h3>');
    expect(html).toContain("accent body.");
    expect(html).not.toContain("colon body.");
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
    // the second file node fills its embed too (not cut as a cycle), with ids of its own
    expect(html.f2).toContain("Other body.");
    expect(html.f2).not.toContain("Circular transclusion");
    expect(html.f1).toContain('id="node-f1--doc--other"');
    expect(html.f2).toContain('id="node-f2--doc-2--other"');
  });
  it("fills the same embed in two text nodes, each with ids of its own", () => {
    const html = renderedNodeHtml(
      canvasData({
        t1: { type: "root", children: [transclude("doc", "#other")] },
        t2: { type: "root", children: [transclude("doc", "#other")] },
      }),
      allFiles,
    );
    for (const h of [html.t1!, html.t2!]) {
      expect(h).toContain("Other body.");
      expect(h).not.toContain("Circular transclusion");
    }
    expect(html.t1).toContain('<h2 id="node-t1--doc--other" data-heading="Other">Other</h2>');
    expect(html.t2).toContain('<h2 id="node-t2--doc-2--other" data-heading="Other">Other</h2>');
  });

  it("fills nested embeds and cuts a note embedding itself", () => {
    const files = [
      ...allFiles,
      { slug: "a", htmlAst: { type: "root", children: [transclude("b")] } },
      { slug: "b", htmlAst: { type: "root", children: [el("p", {}, [text("B body.")])] } },
      { slug: "self", htmlAst: { type: "root", children: [transclude("self")] } },
    ] as unknown as QuartzPluginData[];
    const html = renderedNodeHtml(
      canvasData({
        t1: { type: "root", children: [transclude("a")] },
        t2: { type: "root", children: [transclude("self")] },
      }),
      files,
    );
    expect(html.t1).toContain(
      '<div class="markdown-preview-view markdown-rendered"><p>B body.</p></div>',
    );
    expect(html.t1).not.toContain('class="transclude-inner"');
    expect(html.t2).toContain(
      '<p style="color: var(--secondary);">Circular transclusion detected: self</p>',
    );
  });

  it("keeps the link of an embed whose target or section doesn't exist", () => {
    const files = [
      ...allFiles,
      { slug: "nohtml", frontmatter: { title: "No HTML" } },
    ] as unknown as QuartzPluginData[];
    const data = {
      nodes: [
        { id: "t1", type: "text", text: "…", x: 0, y: 0, width: 200, height: 100 },
        { id: "f1", type: "file", file: "missing.md", x: 300, y: 0, width: 200, height: 100 },
      ],
      edges: [],
      renderedTrees: {
        t1: {
          type: "root",
          children: [transclude("missing"), transclude("doc", "#Nope"), transclude("nohtml")],
        },
      },
    };
    const Body = CanvasBody();
    const vnode = Body({
      fileData: { slug: "board.canvas", canvasData: data } as unknown as QuartzPluginData,
      allFiles: files,
      cfg: {},
    } as never);
    const html = renderedNodeHtml(data, files);
    for (const target of ["missing", "doc#Nope", "nohtml"]) {
      expect(html.t1).toContain(
        `<a href="./${target}" class="transclude-inner" data-slug="${target.split("#")[0]}">Transclude of ${target}</a>`,
      );
    }
    expect(html.t1).not.toContain("markdown-embed");
    // the file node has no content to show: its label links to the note
    expect(html.f1).toBeUndefined();
    const fileNode = findVnodes(vnode, (p) => p["data-node-id"] === "f1")[0]!;
    const links = findVnodes(
      fileNode,
      (p) => p.class === "canvas-file-link internal internal-link",
    );
    expect(links.map((l) => [l.props.href, l.props.children])).toEqual([
      ["./missing", "missing"],
      ["./missing", "missing"],
    ]);
  });

  it("embeds a block by its ^id in any case, and a list item inside its list", () => {
    const files = [
      ...allFiles,
      {
        slug: "blocks",
        htmlAst: { type: "root", children: [] },
        blocks: {
          "para-1": el("p", { id: "^para-1" }, [text("The block")]),
          item: el("li", { id: "^item" }, [text("An item")]),
        },
      },
    ] as unknown as QuartzPluginData[];
    const html = renderedNodeHtml(
      canvasData({
        t1: {
          type: "root",
          children: [transclude("blocks", "#^Para-1"), transclude("blocks", "#^item")],
        },
      }),
      files,
    ).t1!;
    expect(html).not.toContain("Transclude of");
    expect(html).toContain(
      '<div class="markdown-preview-view markdown-rendered"><p id="node-t1--blocks--^para-1">The block</p></div>',
    );
    expect(html).toContain(
      '<div class="markdown-preview-view markdown-rendered"><ul><li id="node-t1--blocks-2--^item">An item</li></ul></div>',
    );
  });

  it("rebases the links inside an embed from a note in a folder", () => {
    const files = [
      ...allFiles.filter((f) => f.slug !== "cafe/creme-brulee"),
      {
        slug: "cafe/creme-brulee",
        htmlAst: { type: "root", children: [el("p", {}, [el("a", { href: "./x" }, [text("x")])])] },
        frontmatter: { title: "Crème brûlée" },
      },
    ] as unknown as QuartzPluginData[];
    const html = renderedNodeHtml(
      canvasData({ t1: { type: "root", children: [transclude("cafe/creme-brulee")] } }),
      files,
    ).t1!;
    const hrefs = [...html.matchAll(/<p><a href="([^"]+)">x<\/a><\/p>/g)].map((m) => m[1]!);
    expect(hrefs.map((h) => new URL(h, "https://example.com/board.canvas").pathname)).toEqual([
      "/cafe/x",
    ]);
  });
});

/** The vnodes under `node` whose props match `pred`. */
function findVnodes(
  node: unknown,
  pred: (props: Record<string, unknown>) => boolean,
): { props: Record<string, unknown> }[] {
  const out: { props: Record<string, unknown> }[] = [];
  const walk = (n: unknown) => {
    if (Array.isArray(n)) return n.forEach(walk);
    if (!n || typeof n !== "object") return;
    const props = (n as { props?: Record<string, unknown> }).props;
    if (!props) return;
    if (pred(props)) out.push(n as { props: Record<string, unknown> });
    walk(props.children);
  };
  walk(node);
  return out;
}

describe("heading sections with footnotes", () => {
  // what GFM renders for "## A\na[^1]\n## B\nb[^2]\n\n[^1]: one\n[^2]: two"
  const fnRef = (n: number) =>
    el("sup", {}, [
      el(
        "a",
        {
          href: `#user-content-fn-${n}`,
          id: `user-content-fnref-${n}`,
          dataFootnoteRef: "",
          ariaDescribedBy: "footnote-label",
        },
        [text(String(n))],
      ),
    ]);
  const fnItem = (n: number, value: string) =>
    el("li", { id: `user-content-fn-${n}` }, [
      el("p", {}, [
        text(`${value} `),
        el(
          "a",
          {
            href: `#user-content-fnref-${n}`,
            dataFootnoteBackref: "",
            ariaLabel: `Back to reference ${n}`,
            className: ["data-footnote-backref"],
          },
          [text("↩")],
        ),
      ]),
    ]);
  const doc: HastRoot = {
    type: "root",
    children: [
      el("h2", { id: "a" }, [text("A")]),
      el("p", {}, [text("a"), fnRef(1)]),
      el("h2", { id: "b" }, [text("B")]),
      el("p", {}, [text("b"), fnRef(2)]),
      el("section", { dataFootnotes: "", className: ["footnotes"] }, [
        el("h2", { className: ["sr-only"], id: "footnote-label" }, [text("Footnotes")]),
        el("ol", {}, [fnItem(1, "one"), fnItem(2, "two")]),
      ]),
    ],
  };
  const allFiles = [{ slug: "doc", htmlAst: doc } as unknown as QuartzPluginData];
  const embed = (subpath: string) =>
    resolveEmbeddedHtml("doc" as FullSlug, "board.canvas" as FullSlug, allFiles, subpath)!;
  const footnoteIds = (html: string) =>
    [...html.matchAll(/<li id="(user-content-fn-\d+)">/g)].map((m) => m[1]);

  it("adds only the footnotes the section references", () => {
    const html = embed("#A");
    expect(html).not.toContain("<p>b");
    expect(html.match(/<section data-footnotes/g)).toHaveLength(1);
    expect(footnoteIds(html)).toEqual(["user-content-fn-1"]);
  });

  it("adds the footnotes section once to the last section, which runs into it", () => {
    const html = embed("#B");
    expect(html).not.toContain("<p>a");
    expect(html.match(/<section data-footnotes/g)).toHaveLength(1);
    expect(footnoteIds(html)).toEqual(["user-content-fn-2"]);
  });
});

describe("canvas options", () => {
  it('textNodeMarkdown: "basic" renders text nodes with basic Markdown despite site plugins', async () => {
    const noop = { name: "Noop", markdownPlugins: () => [], htmlPlugins: () => [] };
    const ctx = createCtx({
      cfg: { configuration: {}, plugins: { transformers: [noop] } } as never,
    });
    ctx.allFiles = ["b.canvas" as FilePath];
    const [page] = await CanvasPage({ textNodeMarkdown: "basic" }).generate!({
      content: [],
      cfg: ctx.cfg.configuration,
      ctx,
    });
    const data = page!.data.canvasData as {
      renderedTexts: Record<string, string>;
      renderedTrees: Record<string, unknown>;
    };
    expect(data.renderedTrees).toEqual({});
    expect(data.renderedTexts).toEqual({
      "1": renderCanvasText("Hello", "b.canvas" as FullSlug, []),
    });
  });

  it("sets the wheel behavior on the canvas container", () => {
    const wheel = (opts?: Parameters<typeof CanvasBody>[0]) => {
      const vnode = CanvasBody(opts)({
        fileData: { slug: "b.canvas", canvasData: sampleCanvas } as unknown as QuartzPluginData,
        allFiles: [],
        cfg: {},
      } as never);
      return findVnodes(vnode, (p) => p.class === "canvas-container").map(
        (v) => v.props["data-wheel-behavior"],
      );
    };
    expect(wheel({ wheelBehavior: "zoom" })).toEqual(["zoom"]);
    expect(wheel({ wheelBehavior: "pan" })).toEqual(["pan"]);
    expect(wheel()).toEqual(["pan"]);
  });
});
