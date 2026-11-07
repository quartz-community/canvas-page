import type {
  QuartzPageTypePlugin,
  PageMatcher,
  FullSlug,
  VirtualPage,
} from "@quartz-community/types";
import { isAbsoluteURL, slugifyFilePath, transformLink } from "@quartz-community/utils/path";
import { readFileSync } from "fs";
import { join } from "path";
import { micromark } from "micromark";
import { gfm, gfmHtml } from "micromark-extension-gfm";
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

function preprocessCanvasData(
  data: CanvasData,
  canvasSlug: FullSlug,
  allSlugs: FullSlug[],
): CanvasData & { renderedTexts: Record<string, string> } {
  const renderedTexts: Record<string, string> = {};

  for (const node of data.nodes ?? []) {
    if (node.type === "text" && node.text) {
      renderedTexts[node.id] = renderCanvasText(node.text, canvasSlug, allSlugs);
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
  generate({ ctx }) {
    const canvasFiles = ctx.allFiles.filter((fp) => fp.endsWith(".canvas"));

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
      const processedData = preprocessCanvasData(canvasData, slug, ctx.allSlugs ?? []);

      virtualPages.push({
        slug,
        title: baseName,
        data: {
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
