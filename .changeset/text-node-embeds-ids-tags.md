---
"@quartz-community/canvas-page": patch
---

Canvas nodes render like notes:

- A file node with a heading subpath (`#Sub Section`, `#Ça va`, as Obsidian stores it) shows that section; it showed only a link, because the subpath was compared with the heading's id. Headings are matched as Quartz matches `[[note#Heading]]`, also with `slugs.stripDiacritics` and inside Obsidian's block wrappers.
- Embeds in text nodes (`![[Doc#Other]]`, `![[Café/Crème brûlée]]`) and in the notes file nodes show are filled, in Obsidian's embed markup, as on a note (circular embeds are cut); they were "Transclude of …" links between empty paragraphs.
- Tags in text nodes (`#tag`) are the canvas page's tags, so tag pages list the canvas (with `@quartz-community/tag-page` 1.0.7+, which builds pages for them; their links were 404s).
- The ids in each node (headings, footnotes) get a prefix of their own (`node-<id>--`) and the node's links point at them: two text nodes with `# Same` or a footnote each shared ids, so a footnote link jumped to the first node's.

Bundles `@quartz-community/utils` 1.3.1.
