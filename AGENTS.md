# AGENTS.md

## Start here

[README.md](README.md) has the code map and what each check does. [docs/game-design.md](docs/game-design.md) opens with which rules are built and which are planned.

- Every check: `npm.cmd run verify`
- One Vitest file: `npx.cmd vitest run src/simulation/simulation.test.ts`, adding `-t "starting a Program"` to pick tests by name
- Browser tests by name: `npx.cmd playwright test -g "explains a game term"`

Even one browser test starts both test servers, including a production build, so it takes about 10 s. They use fixed ports, so run browser tests one at a time. "Port already used" means another run is still going on this machine.

## Agent skills

### Issue tracker

Issues live in GitHub Issues for barnabyg/marsMission, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one root `GLOSSARY.md` plus `docs/adr/`. See `docs/agents/domain.md`.
