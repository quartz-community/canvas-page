import type {
  QuartzPageTypePlugin,
  PageMatcher,
  FilePath,
  FullSlug,
  VirtualPage,
  ProcessedContent,
} from "@quartz-community/types";
import { slugifyFilePath, normalizeHastElement } from "@quartz-community/utils/path";
import { readFileSync } from "fs";
import { join } from "path";
import { micromark } from "micromark";
import { gfm, gfmHtml } from "micromark-extension-gfm";
import { toHtml } from "hast-util-to-html";
import type { Element as HastElement, Root as HastRoot } from "hast";
import CanvasBody from "./components/CanvasBody";
import type { CanvasData, CanvasPageOptions } from "./types";

function renderMarkdown(text: string): string {
  return micromark(text, {
    extensions: [gfm()],
    htmlExtensions: [gfmHtml()],
  });
}

function preprocessCanvasData(
  data: CanvasData,
): CanvasData & { renderedTexts: Record<string, string> } {
  const renderedTexts: Record<string, string> = {};

  for (const node of data.nodes ?? []) {
    if (node.type === "text" && node.text) {
      renderedTexts[node.id] = renderMarkdown(node.text);
    }
  }

  return { ...data, renderedTexts };
}

function buildEmbeddedContent(
  data: CanvasData,
  content: ProcessedContent[],
  canvasSlug: FullSlug,
): Record<string, string> {
  const embeddedHtml: Record<string, string> = {};

  for (const node of data.nodes ?? []) {
    if (node.type !== "file") continue;

    const fileRef = slugifyFilePath(node.file as FilePath, true);
    const match = content.find(([, vfile]) => {
      const slug = vfile.data.slug as string | undefined;
      if (!slug) return false;
      return slug === fileRef || slug.endsWith(`/${fileRef}`);
    });

    if (match) {
      const [, vfile] = match;
      const sourceHtmlAst = (vfile.data as Record<string, unknown>).htmlAst as HastRoot | undefined;
      const sourceSlug = vfile.data.slug as FullSlug | undefined;
      if (sourceHtmlAst && sourceSlug) {
        const rebased: HastRoot = {
          ...sourceHtmlAst,
          children: sourceHtmlAst.children.map((child) =>
            child.type === "element"
              ? (normalizeHastElement(child as HastElement, canvasSlug, sourceSlug) as typeof child)
              : child,
          ),
        };
        embeddedHtml[node.id] = toHtml(rebased as Parameters<typeof toHtml>[0], {
          allowDangerousHtml: true,
        });
      }
    }
  }

  return embeddedHtml;
}

const canvasMatcher: PageMatcher = ({ fileData }) => {
  return "canvasData" in fileData;
};

export const CanvasPage: QuartzPageTypePlugin<CanvasPageOptions> = (opts) => ({
  name: "CanvasPage",
  priority: 20,
  fileExtensions: [".canvas"],
  match: canvasMatcher,
  generate({ ctx, content }) {
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
      const processedData = preprocessCanvasData(canvasData);
      const embeddedContent = buildEmbeddedContent(canvasData, content, slug);

      virtualPages.push({
        slug,
        title: baseName,
        data: {
          frontmatter: { title: baseName, tags: [] },
          canvasData: processedData,
          canvasOptions: opts,
          embeddedContent,
        },
      });
    }

    return virtualPages;
  },
  layout: "canvas",
  frame: "canvas",
  body: CanvasBody,
});
