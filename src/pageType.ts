import type {
  QuartzPageTypePlugin,
  PageMatcher,
  FullSlug,
  VirtualPage,
  BuildCtx,
} from "@quartz-community/types";
import { readFileSync } from "fs";
import { join } from "path";
import CanvasBody from "./components/CanvasBody";
import type { CanvasData, CanvasPageOptions } from "./types";

const canvasMatcher: PageMatcher = ({ slug }) => {
  return slug.endsWith(".canvas");
};

export const CanvasPage: QuartzPageTypePlugin<CanvasPageOptions> = (opts) => ({
  name: "CanvasPage",
  priority: 20,
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

      const slug = filePath as unknown as FullSlug;
      const baseName =
        filePath
          .replace(/\.canvas$/, "")
          .split("/")
          .pop() ?? "Canvas";

      virtualPages.push({
        slug,
        title: baseName,
        data: {
          frontmatter: { title: baseName, tags: [] },
          canvasData,
          canvasOptions: opts,
        },
      });
    }

    return virtualPages;
  },
  layout: "canvas",
  body: CanvasBody,
});
