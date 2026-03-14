import { jsxs, jsx } from 'preact/jsx-runtime';

// src/frames/CanvasFrame.tsx
var CanvasFrame = {
  name: "canvas",
  css: `
.page[data-frame="canvas"] {
  max-width: none;
  margin: 0;
  min-height: 100vh;
}

.page[data-frame="canvas"] > #quartz-body {
  grid-template-columns: auto;
  grid-template-rows: 1fr;
  grid-template-areas:
    "grid-center";
  height: 100vh;
  padding: 0;
}

.page[data-frame="canvas"] > #quartz-body > .center.canvas-frame {
  max-width: 100%;
  min-width: 100%;
  height: 100%;
  margin: 0;
}

.page[data-frame="canvas"] > #quartz-body.lock-scroll > * {
  transform: none;
}
`,
  render({ componentData, pageBody: Content, left }) {
    const renderSlot = (Component) => Component(componentData);
    return /* @__PURE__ */ jsxs("div", { class: "center canvas-frame", children: [
      /* @__PURE__ */ jsxs("button", { class: "canvas-sidebar-toggle", type: "button", "aria-label": "Toggle sidebar", children: [
        /* @__PURE__ */ jsxs(
          "svg",
          {
            xmlns: "http://www.w3.org/2000/svg",
            width: "16",
            height: "16",
            viewBox: "0 0 24 24",
            fill: "none",
            stroke: "currentColor",
            "stroke-width": "2",
            "stroke-linecap": "round",
            "stroke-linejoin": "round",
            class: "canvas-sidebar-icon-open",
            children: [
              /* @__PURE__ */ jsx("line", { x1: "3", y1: "6", x2: "21", y2: "6" }),
              /* @__PURE__ */ jsx("line", { x1: "3", y1: "12", x2: "21", y2: "12" }),
              /* @__PURE__ */ jsx("line", { x1: "3", y1: "18", x2: "21", y2: "18" })
            ]
          }
        ),
        /* @__PURE__ */ jsxs(
          "svg",
          {
            xmlns: "http://www.w3.org/2000/svg",
            width: "16",
            height: "16",
            viewBox: "0 0 24 24",
            fill: "none",
            stroke: "currentColor",
            "stroke-width": "2",
            "stroke-linecap": "round",
            "stroke-linejoin": "round",
            class: "canvas-sidebar-icon-close",
            children: [
              /* @__PURE__ */ jsx("line", { x1: "18", y1: "6", x2: "6", y2: "18" }),
              /* @__PURE__ */ jsx("line", { x1: "6", y1: "6", x2: "18", y2: "18" })
            ]
          }
        )
      ] }),
      /* @__PURE__ */ jsx("aside", { class: "canvas-sidebar", children: left.map((BodyComponent) => renderSlot(BodyComponent)) }),
      /* @__PURE__ */ jsx("div", { class: "canvas-stage", children: renderSlot(Content) })
    ] });
  }
};

export { CanvasFrame };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map