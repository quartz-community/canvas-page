---
"@quartz-community/canvas-page": patch
---

A canvas card embedding a note's heading section (`[[note#Heading]]`) finds the heading inside Obsidian's per-block wrapper (`div.el-h2 > h2`), which `@quartz-community/rehype-obsidian` now renders around each of a note's top-level blocks.
