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

  it("selects a view by its name", () => {
    const done = embed("#Done");
    expect(done).toContain("Done tasks");
    expect(done).not.toContain("Open tasks");
    expect(done).not.toContain("Task board");
  });

  it("matches a view's name by its slug when not exactly", () => {
    expect(embed("#done")).toContain("Done tasks");
    expect(embed("#board")).toContain("Task board");
  });

  it("prefers a view's name over a view type", () => {
    const named = [
      {
        slug: "named.base" as FullSlug,
        basesData: {},
        htmlAst: {
          type: "root",
          children: [
            el("div", { className: ["bases-page"] }, [
              el("div", { role: "tablist" }, [tab(0, "Overview"), tab(1, "cards")]),
              el("div", { className: ["bases-view-container"] }, [
                panel(0, "Card grid", "cards"),
                panel(1, "Table named cards"),
              ]),
            ]),
          ],
        } as HastRoot,
      } as unknown as QuartzPluginData,
    ];
    const html = resolveEmbeddedHtml(
      "named.base" as FullSlug,
      "c.canvas" as FullSlug,
      named,
      "#cards",
    );
    expect(html).toContain("Table named cards");
    expect(html).not.toContain("Card grid");
  });

  it("shows the view it selects", () => {
    expect(embed("#cards") ?? "").toMatch(/class="bases-view is-active"[^>]*>Task board/);
    expect(embed("#Done") ?? "").toMatch(/class="bases-view is-active"[^>]*>Done tasks/);
    // the first view is active already: not marked twice
    expect(embed("#Open") ?? "").toMatch(/class="bases-view is-active"[^>]*>Open tasks/);
  });

  it("leaves the base's own tree unchanged", () => {
    embed("#Done");
    const container = (htmlAst.children[0] as Element).children[1] as Element;
    expect((container.children[1] as Element).properties.className).toEqual(["bases-view"]);
  });
});
