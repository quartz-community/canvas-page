---
"@quartz-community/canvas-page": patch
---

Bundles `@quartz-community/utils` 1.3, so `configuration.slugs.stripDiacritics` (Quartz 5.3) also applies to file nodes' links and links in text nodes. Before, the plugin bundled an older utils that ignored the option, and its slugs kept their diacritics.
