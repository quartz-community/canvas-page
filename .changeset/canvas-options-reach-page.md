---
"@quartz-community/canvas-page": patch
---

CanvasPage options (`enableInteraction`, `initialZoom`, `minZoom`, `maxZoom`, `wheelBehavior`) now take effect on canvas pages; they were ignored before, and `initialZoom` now scales the opening view that fits the whole canvas.
