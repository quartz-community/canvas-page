---
"@quartz-community/canvas-page": patch
---

Canvas pages now carry the path of their `.canvas` file (`filePath` / `relativePath`) instead of a made-up `<name>.canvas.md`. Base views (bases-page) list canvas files with `file.path`, `file.ext` (`canvas`), `file.folder` and `file.inFolder()` as Obsidian does, the content index records the real file path, and canvas pages get their generated social image.
