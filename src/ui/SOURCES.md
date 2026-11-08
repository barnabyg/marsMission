# Icon sources

The icons in `icons.ts`, with their source and licence, as [ADR 0005](../../docs/adr/0005-free-open-licensed-media-only.md) requires.

## Lucide

Icons: `alert-triangle`, `arrow-down`, `arrow-right`, `arrow-up`, `atom`, `award`, `calendar`, `chevron-down`, `chevron-left`, `chevron-right`, `chevron-up`, `chevrons-right`, `coins`, `fast-forward`, `flask-conical`, `heart`, `hourglass`, `package`, `pause`, `play`, `rocket`, `shield-alert`, `target`, `trophy`, `users`, `volume-2`, `volume-x`, `wallet`, `weight`, `zap`.

- What: the shapes of the icons listed in `icons.ts`, copied unmodified from the package's `icon-nodes.json`. `shield-alert` is Lucide's `shield-exclamation-point` and `alert-triangle` is its `triangle-exclamation-point`; the rest keep their Lucide names.
- Source: https://lucide.dev/, from the npm package `lucide-static` 1.68.0 (https://www.npmjs.com/package/lucide-static). The game bundles the shapes itself and doesn't depend on the package.
- Credit: Lucide Icons and Contributors. Some icons are derived from Feather, by Cole Bemis.
- Licence: ISC, with the MIT licence for the icons derived from Feather. Both are in [LICENSE-lucide.txt](LICENSE-lucide.txt).

To add an icon, find it on https://lucide.dev/icons/, copy its shapes from `icon-nodes.json` in the same version of `lucide-static` into `icons.ts`, and keep the list above accurate.
