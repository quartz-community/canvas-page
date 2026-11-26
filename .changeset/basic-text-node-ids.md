---
"@quartz-community/canvas-page": patch
---

Text nodes rendered with `textNodeMarkdown: basic` get their ids scoped per node too, so footnotes in two text nodes no longer share ids and their links go to their own node's footnotes.
