---
"@quartz-community/canvas-page": minor
---

feat: text nodes are rendered with the site's own Markdown plugins, like a note, as in Obsidian. Mermaid diagrams render (with Pele, Quartz 5.3's default, or Mermaid.js), and so do callouts, math, syntax highlighting and wikilinks. `textNodeMarkdown: "basic"` keeps the previous plain CommonMark + GFM rendering. A text node that a site plugin fails on falls back to it with a warning. Requires Quartz 5.1+ (asynchronous page generation).
