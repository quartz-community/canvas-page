# Changelog

## 1.1.3

### Patch Changes

- 5908950: Text nodes rendered with `textNodeMarkdown: basic` get their ids scoped per node too, so footnotes in two text nodes no longer share ids and their links go to their own node's footnotes.

## 1.1.2

### Patch Changes

- 8e77c70: Canvas nodes render like notes:

  - A file node with a heading subpath (`#Sub Section`, `#Ça va`, as Obsidian stores it) shows that section; it showed only a link, because the subpath was compared with the heading's id. Headings are matched as Quartz matches `[[note#Heading]]`, also with `slugs.stripDiacritics` and inside Obsidian's block wrappers.
  - Embeds in text nodes (`![[Doc#Other]]`, `![[Café/Crème brûlée]]`) and in the notes file nodes show are filled, in Obsidian's embed markup, as on a note (circular embeds are cut); they were "Transclude of …" links between empty paragraphs.
  - Tags in text nodes (`#tag`) are the canvas page's tags, so tag pages list the canvas (with `@quartz-community/tag-page` 1.0.7+, which builds pages for them; their links were 404s).
  - The ids in each node (headings, footnotes) get a prefix of their own (`node-<id>--`) and the node's links point at them: two text nodes with `# Same` or a footnote each shared ids, so a footnote link jumped to the first node's.

  Bundles `@quartz-community/utils` 1.3.1.

## 1.1.1

### Patch Changes

- b70b684: Bundles `@quartz-community/utils` 1.3, so `configuration.slugs.stripDiacritics` (Quartz 5.3) also applies to file nodes' links and links in text nodes. Before, the plugin bundled an older utils that ignored the option, and its slugs kept their diacritics.

## 1.1.0

### Minor Changes

- eb2ba39: feat: text nodes are rendered with the site's own Markdown plugins, like a note, as in Obsidian. Mermaid diagrams render (with Pele, Quartz 5.3's default, or Mermaid.js), and so do callouts, math, syntax highlighting and wikilinks. `textNodeMarkdown: "basic"` keeps the previous plain CommonMark + GFM rendering. A text node that a site plugin fails on falls back to it with a warning. Requires Quartz 5.1+ (asynchronous page generation).
- b85fc8a: feat: the mouse wheel and two-finger trackpad scroll now pan the canvas, as in Obsidian (Shift + wheel pans sideways); Ctrl/Cmd + wheel and pinching zoom around the pointer, including Safari's pinch gestures. The new `wheelBehavior: "zoom"` option keeps the previous behaviour, where the wheel always zooms.

## 1.0.4

### Patch Changes

- bd641c3: A canvas card embedding a note's heading section (`[[note#Heading]]`) finds the heading inside Obsidian's per-block wrapper (`div.el-h2 > h2`), which `@quartz-community/rehype-obsidian` now renders around each of a note's top-level blocks.

## 1.0.3

### Patch Changes

- 4e37c47: Uses Quartz's own `preact` instead of bundling a second copy (`noExternal` in the build overrode the externals). Components now share one Preact instance with Quartz and other plugins, so hooks and context work across them, and the bundle is smaller.

## 1.0.2

### Patch Changes

- abf5c4a: Canvas pages now carry the path of their `.canvas` file (`filePath` / `relativePath`) instead of a made-up `<name>.canvas.md`. Base views (bases-page) list canvas files with `file.path`, `file.ext` (`canvas`), `file.folder` and `file.inFolder()` as Obsidian does, the content index records the real file path, and canvas pages get their generated social image.
- 283c325: Bundles `@quartz-community/utils` 1.1.0: a short wikilink to an Obsidian folder note (`[[Topic]]` for `Topic/Topic.md`) reaches the folder page, and anchors to headings use the same slug as heading ids. `github-slugger` is no longer a dependency of this plugin.

## 1.0.1

### Patch Changes

- f9e94ed: Resolve links in canvas text nodes: `[Note](Note.md)` links and `[[wikilinks]]` (including `[[Note|alias]]` and `[[Note#Heading]]`) now point to the rendered pages instead of 404ing (jackyzha0/quartz#2569).

## 1.0.0

### Major Changes

- Stable 1.0 release. All `@quartz-community/*` dependencies now use `^1.0.0` ranges.

  Pre-1.0 caret ranges pinned the minor version (`^0.2.1` means `>=0.2.1 <0.3.0`), so
  published fixes to shared packages could never be resolved by dependents. Moving the
  ecosystem to 1.0 makes caret ranges behave conventionally.

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial Quartz community plugin template.
