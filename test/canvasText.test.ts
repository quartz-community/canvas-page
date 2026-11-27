import { describe, expect, it } from "vitest";
import type { FilePath, FullSlug } from "@quartz-community/types";
import { slugifyFilePath } from "@quartz-community/utils/path";
import { renderCanvasText } from "../src/pageType";

const allSlugs = ["Note.md"].map((fp) => slugifyFilePath(fp as FilePath));
const render = (text: string) => renderCanvasText(text, "board.canvas" as FullSlug, allSlugs);

describe("text node wikilinks (basic Markdown)", () => {
  it("ignores spaces around the target and the alias", () => {
    expect(render("[[ Note | the note ]]")).toContain(
      '<a href="./note" class="internal internal-link">the note</a>',
    );
  });

  it("keeps backslashes in the link text", () => {
    expect(render("[[Note|x \\ y]]")).toContain(">x \\ y</a>");
  });

  it("leaves an empty wikilink as written", () => {
    expect(render("[[ |alias]]")).toBe("<p>[[ |alias]]</p>");
  });

  it("leaves root-relative links as written", () => {
    expect(render("[x](/notes/x)")).toBe('<p><a href="/notes/x">x</a></p>');
  });
});
