import type {
  BuildCtx,
  PluginTypes,
  QuartzPageTypePlugin,
  PageMatcher,
  FilePath,
  FullSlug,
  VirtualPage,
} from "@quartz-community/types";
import {
  isAbsoluteURL,
  joinSegments,
  slugifyFilePath,
  transformLink,
} from "@quartz-community/utils/path";
import { readFileSync } from "fs";
import { join } from "path";
import { micromark } from "micromark";
import { gfm, gfmHtml } from "micromark-extension-gfm";
import { unified, type PluggableList } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { toHtml } from "hast-util-to-html";
import type { Root as MdRoot } from "mdast";
import type { Root as HastRoot } from "hast";
import { VFile } from "vfile";
import CanvasBody from "./components/CanvasBody";
import type { CanvasData, CanvasPageOptions } from "./types";

// [[target]], [[target#heading]], [[target|alias]]; embeds (![[...]]) are left untouched
const wikilinkRegex = /(!?)\[\[([^[\]\n]+?)\]\]/g;

function wikilinksToMarkdown(text: string): string {
  return text.replace(wikilinkRegex, (match, embed: string, inner: string) => {
    if (embed) return match;
    const pipe = inner.indexOf("|");
    const target = (pipe === -1 ? inner : inner.slice(0, pipe)).trim();
    const alias = pipe === -1 ? undefined : inner.slice(pipe + 1).trim();
    if (!target) return match;
    const label = (alias || target.replace("#", " > ")).replace(/([[\]\\])/g, "\\$1");
    return `[${label}](<${target.replace(/[<>]/g, "")}>)`;
  });
}

function decodeHtmlAttr(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function encodeHtmlAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

/**
 * Render the markdown of a canvas text node. Wikilinks and internal links
 * (`[Note](Note.md)`) are resolved against the site's slugs (shortest-path
 * match, like Obsidian) and rewritten relative to the canvas page.
 */
export function renderCanvasText(text: string, canvasSlug: FullSlug, allSlugs: FullSlug[]): string {
  const html = micromark(wikilinksToMarkdown(text), {
    extensions: [gfm()],
    htmlExtensions: [gfmHtml()],
  });

  return html.replace(/<a href="([^"]*)"/g, (match, rawHref: string) => {
    const href = decodeHtmlAttr(rawHref);
    if (!href || href.startsWith("#") || href.startsWith("/") || isAbsoluteURL(href)) {
      return match;
    }
    const resolved = transformLink(canvasSlug, href, { strategy: "shortest", allSlugs });
    return `<a href="${encodeHtmlAttr(resolved)}" class="internal internal-link"`;
  });
}

/** Renders a text node's markdown to HTML for the canvas page `file`. */
export type CanvasTextRenderer = (
  text: string,
  file: { slug: FullSlug; filePath: FilePath; relativePath: FilePath },
) => Promise<string>;

/**
 * A renderer that runs text nodes through the site's own Markdown pipeline: every transformer's
 * `textTransform`, `markdownPlugins` and `htmlPlugins`, in the site's order, as Quartz does for a
 * note. So text nodes get what notes get, as in Obsidian: wikilinks and embeds, callouts,
 * Mermaid diagrams (Pele or Mermaid.js, whatever the site uses), math, syntax highlighting, tags,
 * and links resolved with the site's link resolution.
 *
 * Returns `undefined` when the build has no transformers to run (e.g. a bare test context).
 */
export function createSiteTextRenderer(ctx: BuildCtx): CanvasTextRenderer | undefined {
  // `cfg.plugins` is typed `unknown` in @quartz-community/types; Quartz passes its PluginTypes
  const transformers = (ctx.cfg?.plugins as Partial<PluginTypes> | undefined)?.transformers;
  if (!transformers || transformers.length === 0) return undefined;

  const mdProcessor = unified()
    .use(remarkParse)
    .use(transformers.flatMap((t) => (t.markdownPlugins?.(ctx) ?? []) as PluggableList));
  const htmlProcessor = unified()
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(transformers.flatMap((t) => (t.htmlPlugins?.(ctx) ?? []) as PluggableList));

  return async (text, { slug, filePath, relativePath }) => {
    let src = text.trim();
    for (const t of transformers) {
      if (t.textTransform) src = t.textTransform(ctx, src);
    }
    // the canvas file stands in for the note: plugins resolve links from its slug, and
    // read its path (e.g. for dates)
    const file = new VFile({ value: src, path: filePath });
    file.data = { slug, filePath, relativePath };
    const mdast = (await mdProcessor.run(mdProcessor.parse(file) as MdRoot, file)) as MdRoot;
    const hast = (await htmlProcessor.run(mdast as never, file)) as unknown as HastRoot;
    return toHtml(hast, { allowDangerousHtml: true });
  };
}

async function preprocessCanvasData(
  data: CanvasData,
  file: { slug: FullSlug; filePath: FilePath; relativePath: FilePath },
  allSlugs: FullSlug[],
  siteRenderer: CanvasTextRenderer | undefined,
): Promise<CanvasData & { renderedTexts: Record<string, string> }> {
  const renderedTexts: Record<string, string> = {};

  for (const node of data.nodes ?? []) {
    if (node.type === "text" && node.text) {
      if (siteRenderer) {
        try {
          renderedTexts[node.id] = await siteRenderer(node.text, file);
          continue;
        } catch (err) {
          console.warn(
            `[canvas-page] ${file.relativePath}: text node ${node.id} could not be rendered with the site's Markdown plugins, using basic Markdown:`,
            err,
          );
        }
      }
      renderedTexts[node.id] = renderCanvasText(node.text, file.slug, allSlugs);
    }
  }

  return { ...data, renderedTexts };
}

const canvasMatcher: PageMatcher = ({ fileData }) => {
  return "canvasData" in fileData;
};

export const CanvasPage: QuartzPageTypePlugin<CanvasPageOptions> = (opts) => ({
  name: "CanvasPage",
  priority: 20,
  fileExtensions: [".canvas"],
  match: canvasMatcher,
  async generate({ ctx }) {
    const canvasFiles = ctx.allFiles.filter((fp) => fp.endsWith(".canvas"));
    const siteRenderer =
      (opts?.textNodeMarkdown ?? "site") === "site" ? createSiteTextRenderer(ctx) : undefined;

    const virtualPages: VirtualPage[] = [];

    for (const filePath of canvasFiles) {
      const fullPath = join(ctx.argv.directory, filePath);
      let canvasData: CanvasData;

      try {
        const raw = readFileSync(fullPath, "utf-8");
        canvasData = JSON.parse(raw) as CanvasData;
      } catch {
        continue;
      }

      const baseName =
        filePath
          .replace(/\.canvas$/, "")
          .split("/")
          .pop() ?? "Canvas";
      const slug = slugifyFilePath(filePath) as FullSlug;
      const sourcePath = joinSegments(ctx.argv.directory, filePath) as FilePath;
      const processedData = await preprocessCanvasData(
        canvasData,
        { slug, filePath: sourcePath, relativePath: filePath },
        ctx.allSlugs ?? [],
        siteRenderer,
      );

      virtualPages.push({
        slug,
        title: baseName,
        data: {
          // The page stands for the .canvas file: give it the source paths Quartz's parser
          // sets on notes (instead of the synthetic `<slug>.md`), so bases list it with
          // file.ext "canvas", and folder listings and the content index see its real path.
          filePath: sourcePath,
          relativePath: filePath,
          frontmatter: { title: baseName, tags: [] },
          canvasData: processedData,
          canvasOptions: opts,
        },
      });
    }

    return virtualPages;
  },
  layout: "canvas",
  frame: "canvas",
  body: CanvasBody,
});
