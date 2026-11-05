# Local browser game for 4K and 1920×1080 desktops

The game runs entirely in the browser on a powerful local PC. There is no server, and saves are stored locally. It targets desktop monitors: a 4K monitor, and a 1920×1080 one. Windows display scaling changes what the browser sees: a 4K monitor at 150% gives the browser 2560×1440. Layouts must work at 3840×2160, 2560×1440 and 1920×1080, and text is sized in ordinary pixels so that it follows the player's display scaling. We deliberately don't support mobile, touch or smaller screens. The stack is TypeScript (strict), Vite and React for Planning Mode, and Three.js through react-three-fiber for Mission Mode.

## Amended

1920×1080 was added on 2026-11-05 (#138). The decision first supported only 3840×2160 and 2560×1440. Layouts now share the room by wrapping and by letting panels scroll by themselves, rather than by switching layout at a breakpoint. At 1920×1080, a busy Program's panels beside the New Mission may scroll up and down, and nothing anywhere scrolls sideways or is cut off.

## Consequences

- Layouts are fluid between 1920×1080 and 3840×2160: choices wrap and panels scroll by themselves. Mobile layouts are out of scope, so don't add breakpoints for screens smaller than 1920×1080.
- The layout browser tests check every supported size.
- Asset quality and rendering budgets are set for high-end hardware, not average hardware.
