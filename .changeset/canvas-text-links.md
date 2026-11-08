---
"@quartz-community/canvas-page": patch
---

Resolve links in canvas text nodes: `[Note](Note.md)` links and `[[wikilinks]]` (including `[[Note|alias]]` and `[[Note#Heading]]`) now point to the rendered pages instead of 404ing (jackyzha0/quartz#2569).
