# Local browser game targeting 4K desktops only

The game runs entirely in the browser on a powerful local PC with a 4K monitor. There is no server, and saves are stored locally. We deliberately don't support mobile, touch or low-resolution displays, so layouts and Mission Mode graphics can assume about 3840×2160 and a capable GPU. The stack is TypeScript (strict), Vite and React for Planning Mode, and Three.js through react-three-fiber for Mission Mode.

## Consequences

- Responsive or mobile layouts are out of scope. Don't add breakpoints for small screens.
- Asset quality and rendering budgets are set for high-end hardware, not average hardware.
