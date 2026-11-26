---
"@quartz-community/canvas-page": patch
---

A file node's `#^block` subpath and a `![[note#^block]]` in a text node find the block whatever the case of its id (`#^Para-1`), as Obsidian stores it as written; blocks are keyed by their lowercased name. Rebuilt with `@quartz-community/utils` 1.3.2, links to blocks in basic-Markdown text nodes are `#^id`, matching the blocks' new `^id` ids.
