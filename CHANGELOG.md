# Changelog

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
