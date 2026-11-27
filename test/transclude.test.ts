import { describe, expect, it } from "vitest";
import type { FullSlug, QuartzPluginData } from "@quartz-community/types";
import type { Element, ElementContent, Root } from "hast";
import {
  blockOf,
  findHeadingSection,
  findPage,
  headingMatches,
} from "../src/components/transclude";

const el = (tagName: string, properties: Element["properties"], children: ElementContent[] = []) =>
  ({ type: "element", tagName, properties, children }) as Element;
const t = (value: string) => ({ type: "text", value }) as const;

describe("headings named by their text", () => {
  // as Quartz renders a heading: its text, then the anchor link; a collapse icon is aria-hidden
  const heading = el("h2", { id: "custom-id" }, [
    t(" Ça va "),
    el("a", { role: "anchor", ariaHidden: "true", href: "#custom-id" }, [t("#")]),
    el("span", { ariaHidden: "true" }, [t("▾")]),
  ]);

  it("matches the text as written, without the anchor link or icons Quartz adds", () => {
    expect(headingMatches(heading, "Ça va")).toBe(true);
    expect(headingMatches(heading, "ça-va")).toBe(true);
    expect(headingMatches(heading, "Ça va #")).toBe(false);
  });

  it("prefers the text Quartz recorded for it", () => {
    const recorded = el("h2", { id: "x", dataHeading: "Recorded" }, [t("Shown")]);
    expect(headingMatches(recorded, "Recorded")).toBe(true);
    expect(headingMatches(recorded, "Shown")).toBe(false);
  });

  it("finds the section, nested text included, up to the next heading of its level", () => {
    const children: Root["children"] = [
      el("h1", {}, [t("Top")]),
      el("h2", { id: "a" }, [el("em", {}, [t("Part")]), t(" one")]),
      el("p", {}, [t("body")]),
      el("h3", {}, [t("Sub")]),
      el("h2", {}, [t("Part two")]),
    ];
    expect(findHeadingSection(children, "Part one")).toEqual({ start: 1, end: 4 });
    expect(findHeadingSection(children, "Part two")).toEqual({ start: 4, end: undefined });
  });
});

describe("blockOf", () => {
  const p = el("p", {}, [t("x")]);

  it("unwraps Obsidian's per-block wrapper", () => {
    expect(blockOf(el("div", { className: ["el-p"] }, [t("\n"), p, t("\n")]))).toBe(p);
  });

  it("keeps other nodes", () => {
    const twoBlocks = el("div", { className: ["el-div"] }, [p, el("p", {}, [])]);
    expect(blockOf(twoBlocks)).toBe(twoBlocks);
    const notAWrapper = el("div", { className: ["model-p"] }, [p]);
    expect(blockOf(notAWrapper)).toBe(notAWrapper);
    const section = el("section", { className: ["el-p"] }, [p]);
    expect(blockOf(section)).toBe(section);
  });
});

describe("findPage", () => {
  const page = (slug: string, title: string) =>
    ({ slug, frontmatter: { title } }) as QuartzPluginData;

  it("finds a page by its slug", () => {
    const files = [page("a", "A"), page("b", "B")];
    expect(findPage("b" as FullSlug, files)?.frontmatter?.title).toBe("B");
  });

  it("finds a virtual page by its file's name without the extension, the last one listed", () => {
    // a note `tasks.md` and the page a pageType plugin made from `tasks.base` (added later)
    const files = [page("other", "Other"), page("tasks", "note"), page("tasks", "base")];
    expect(findPage("tasks.base" as FullSlug, files)?.frontmatter?.title).toBe("base");
    expect(findPage("missing.base" as FullSlug, files)).toBeUndefined();
    // a dot file in a folder has no extension to strip
    expect(findPage("notes/.hidden" as FullSlug, [page("notes/", "folder")])).toBeUndefined();
  });
});
