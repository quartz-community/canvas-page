import { describe, expect, it } from "vitest";
import type { FullSlug, QuartzPluginData } from "@quartz-community/types";
import type { Element, Root as HastRoot } from "hast";
import { resolveEmbeddedHtml } from "../src/components/CanvasBody";

// A base with two table views and a cards view as bases-page renders it: tabs named after the views (the first
// active), and a panel per view. Only the active panel is shown (`.bases-view { display: none }`,
// `.bases-view.is-active { display: block }`).
const el = (tagName: string, properties: Element["properties"], children: Element["children"]) =>
  ({ type: "element", tagName, properties, children }) as Element;
const tab = (index: number, name: string) =>
  el(
    "button",
    {
      role: "tab",
      id: `bases-tab-${index}`,
      ariaControls: [`bases-view-${index}`],
      className: index === 0 ? ["is-active"] : [],
      dataViewIndex: index,
    },
    [{ type: "text", value: name }],
  );
const panel = (index: number, body: string, type = "table") =>
  el(
    "div",
    {
      className: index === 0 ? ["bases-view", "is-active"] : ["bases-view"],
      id: `bases-view-${index}`,
      role: "tabpanel",
      ariaLabelledBy: [`bases-tab-${index}`],
      dataViewIndex: index,
      dataViewType: type,
    },
    [{ type: "text", value: body }],
  );
const htmlAst: HastRoot = {
  type: "root",
  children: [
    el("div", { className: ["bases-page"] }, [
      el("div", { className: ["bases-view-tabs"], role: "tablist" }, [
        tab(0, "Open"),
        tab(1, "Done"),
        tab(2, "Board"),
      ]),
      el("div", { className: ["bases-view-container"] }, [
        panel(0, "Open tasks"),
        panel(1, "Done tasks"),
        panel(2, "Task board", "cards"),
      ]),
    ]),
  ],
};
const allFiles = [
  { slug: "tasks.base" as FullSlug, htmlAst, basesData: {} } as unknown as QuartzPluginData,
];
const embed = (subpath: string) =>
  resolveEmbeddedHtml("tasks.base" as FullSlug, "c.canvas" as FullSlug, allFiles, subpath);

describe("a file node showing one view of a base", () => {
  it("selects a view by its type", () => {
    expect(embed("#table")).toContain("Open tasks");
    expect(embed("#cards")).toContain("Task board");
    expect(embed("#list")).toBeUndefined();
  });

  // bug: CanvasBody's findBasesView matches only data-view-type, not the view's name (the tab
  // label), though its comment says both. `#Done` (a view's name, as `![[tasks.base#Done]]`
  // names it) finds nothing, and two views of one type can't be told apart.
  it.fails("selects a view by its name", () => {
    const done = embed("#Done");
    expect(done).toContain("Done tasks");
    expect(done).not.toContain("Open tasks");
  });

  // bug: the selected view is returned without `is-active` (the comment says "marked active"),
  // so with bases-page's stylesheet a view other than the first is hidden in the node.
  it.fails("shows the view it selects", () => {
    const html = embed("#cards") ?? "";
    expect(html).toMatch(/class="bases-view is-active"[^>]*>Task board/);
  });
});
