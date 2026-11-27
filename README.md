# @quartz-community/canvas-page

A page type plugin that renders [JSON Canvas](https://jsoncanvas.org) (`.canvas`) files as interactive, pannable and zoomable canvas pages. Supports the full JSON Canvas 1.0 spec, including text nodes with Markdown rendering, file nodes that link to other pages, link nodes for external URLs, group nodes for visual organization, and edges between nodes rendered as SVG paths with optional labels, arrow markers, and colors.

## Installation

```bash
npx quartz plugin add @quartz-community/canvas-page
```

It is already included (and enabled) in the default `quartz.config.yaml`.

## Usage

```yaml title="quartz.config.yaml"
plugins:
  - source: "@quartz-community/canvas-page"
    enabled: true
```

For advanced use cases, you can override in TypeScript:

```ts title="quartz.ts (override)"
import * as ExternalPlugin from "./.quartz/plugins";

ExternalPlugin.CanvasPage({
  enableInteraction: true,
  initialZoom: 1,
});
```

## Features

- **Text nodes**: Rendered with the site's own Markdown plugins, like a note (as in Obsidian): wikilinks, callouts, Mermaid diagrams (Pele or Mermaid.js, as configured in ObsidianFlavoredMarkdown), math, syntax highlighting. Set `textNodeMarkdown: basic` for plain CommonMark + GFM. Embeds (`![[Note]]`, `![[Note#Heading]]`) are filled in as on a note, and tags in text nodes are the canvas page's tags (tag pages list it; tag-page 1.0.7+ builds pages for tags only canvases use). Each node's ids (headings, footnotes) get a prefix of their own, so nodes don't share ids.
- **File nodes**: Link to other pages in your vault with popover previews on hover.
- **Link nodes**: Reference external URLs.
- **Group nodes**: Visual grouping containers with optional labels and background colors.
- **Edges**: SVG connections between nodes with optional labels, arrow markers, and colors. Supports all four sides and both preset colors (1–6) and custom hex colors.
- **Canvas frame**: Canvas pages use the plugin's own fullscreen `canvas` page frame with a togglable left sidebar (set `layout.byPageType.canvas.template: default` for the standard three-column layout). Embedded canvases get a fullscreen toggle button instead.
- **Preset colors**: Six preset colors (red, orange, yellow, green, cyan, purple) plus custom hex colors for nodes and edges.

## Configuration

| Option              | Type                | Default  | Description                                                                                                                                                                            |
| ------------------- | ------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enableInteraction` | `boolean`           | `true`   | Whether to enable pan and zoom interaction on the canvas (`false` also hides the zoom buttons).                                                                                        |
| `initialZoom`       | `number`            | `1`      | The zoom the canvas opens at, relative to the view that fits the whole canvas: `1` shows it all, `2` opens twice as close. Kept within `minZoom` and `maxZoom`.                        |
| `minZoom`           | `number`            | `0.1`    | The minimum zoom level allowed when zooming out.                                                                                                                                       |
| `maxZoom`           | `number`            | `5`      | The maximum zoom level allowed when zooming in.                                                                                                                                        |
| `wheelBehavior`     | `"pan" \| "zoom"`   | `"pan"`  | What the mouse wheel / two-finger scroll does. `"pan"` moves the canvas like Obsidian (Shift + wheel: sideways); Ctrl/Cmd + wheel and pinching zoom. `"zoom"`: the wheel always zooms. |
| `textNodeMarkdown`  | `"site" \| "basic"` | `"site"` | How text nodes are rendered: with the site's Markdown plugins, or plain CommonMark + GFM (wikilinks and links to notes still resolved).                                                |

## Documentation

See the [Quartz documentation](https://quartz.jzhao.xyz/plugins/CanvasPage) for more information.

## License

MIT
