# Font sources

The fonts bundled with the game, with their source and licence, as [ADR 0005](../../../docs/adr/0005-free-open-licensed-media-only.md) requires. They load from the game's own files, with no network access ([ADR 0001](../../../docs/adr/0001-local-browser-game-for-4k-desktop.md)).

## Barlow Condensed

File: `barlow-condensed-latin-600-normal.woff2`, the SemiBold weight, Latin characters only. `styles.css` uses it for headings and the values players read at a glance, through `--font-display`.

- What: the file copied unmodified from the npm package.
- Source: Barlow, by Jeremy Tribby, https://github.com/jpt/barlow, from the npm package `@fontsource/barlow-condensed` 5.3.0 (https://www.npmjs.com/package/@fontsource/barlow-condensed). The game bundles the file itself and doesn't depend on the package.
- Credit: Copyright 2017 The Barlow Project Authors.
- Licence: SIL Open Font License 1.1, in [LICENSE-barlow-condensed.txt](LICENSE-barlow-condensed.txt).

Body text stays in the system font, Segoe UI on Windows, which isn't bundled.
