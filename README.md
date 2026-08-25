# agenticdevelopertoolkit

A set of reusable per-platform packages — sixteen web libraries (`ui`,
`chat`, `editing`, `markdown`, `search`, `themes`, and more, listed in full
below), a Swift package for Apple, and a Python package for Terminal.
Android and Windows are port plans in `docs/planning/ports/`, with no code
yet.

Persona-chat wiring is one capability among them, not the toolkit's
identity: the `chat` package's `PersonaChatBackend` splices the
[official agentic registry](https://github.com/agentic-cookbook/agenticregistry)
(persona definitions + LLM provider integrations) and
[my-agentic-storage](https://github.com/agentic-cookbook/my-agentic-storage)
(chat history + state) into the shape a chat UI expects, so a consumer app
does not have to re-implement that orchestration.

Supersedes the deprecated `agentic-persona-coordinator`.

## Layout

Each platform folder under `packages/` is the **root of its native build
system** — open it and you'll find the conventional manifest for that
platform.

| Platform | Folder | Manifest | Status |
|---|---|---|---|
| Web (TS) | `packages/web/` | `package.json` (pnpm workspace) | active |
| Apple | `packages/apple/` | `Package.swift` + `project.yml` | active |
| Terminal (Python) | `packages/terminal/` | `pyproject.toml` | active |
| Android | `packages/android/` | (TBD) | placeholder |
| Windows | `packages/windows/` | (TBD) | placeholder |
| Demo site | `websites/demo/` | `package.json` | active |

The web platform is a pnpm monorepo with libraries under
`packages/web/packages/`:

- `@agenticdevelopertoolkit/avatar` — headless avatar behaviour and the
  `useAvatarEngine` hook.
- `@agenticdevelopertoolkit/chat` — React chat components (`InlineChat`,
  `ThreePaneChat`, `MobileChat`, `PersonaChat`) with pluggable backends.
- `@agenticdevelopertoolkit/chrome` — site chrome: the menu button and the
  close glyph derived from it.
- `@agenticdevelopertoolkit/controls` — settings, search dialog, dev banner,
  logging panel, and the other small operator-facing controls a consumer site
  wires up around the rest of the kit.
- `@agenticdevelopertoolkit/editing` — a host-agnostic inline-editing
  container: sections, validation, repair, and the scope/server plumbing
  around them.
- `@agenticdevelopertoolkit/landing` — a snap-scrolling, long-form landing
  page kit: the scroll deck, fixed-header chrome, and a vocabulary of
  presentational blocks, themed entirely through `--lp-*` custom properties.
- `@agenticdevelopertoolkit/markdown` — a markdown renderer with its own
  component set, syntax themes, and rendering hooks.
- `@agenticdevelopertoolkit/model` — provider integrations, hooks, and
  library helpers for talking to an LLM provider.
- `@agenticdevelopertoolkit/popover` — hover popovers: the anchored panel, its
  pointing arrow, and the hover-intent state for a row of them.
- `@agenticdevelopertoolkit/registry-profile` — renders a registry service's
  public profile: fields, service list, and the surrounding layout.
- `@agenticdevelopertoolkit/registry-types` — shared types, validation, and
  visibility rules for registry data.
- `@agenticdevelopertoolkit/search` — a search UI (components, data layer,
  and a small results registry) for querying a site's own content.
- `@agenticdevelopertoolkit/textlens` — a travelling lens that magnifies,
  softens and tints each character of a line as it passes.
- `@agenticdevelopertoolkit/themes` — Theme manifest, `ThemeStyle`, and
  `ColorModeProvider`, plus the page-level, unscoped accessibility styles
  (`data-reduce-motion`, `data-contrast`, `data-text-size`) that sit alongside
  the per-widget theme scoping.
- `@agenticdevelopertoolkit/ui` — the shared UI kit: primitives (the shadcn
  slot + `cn` helper), a larger vocabulary of composed blocks, and the global
  styles they share.
- `@agenticdevelopertoolkit/viewport` — iOS-correct viewport / keyboard
  primitives.

## Build

One-shot bootstrap (installs the web workspace and runs theme codegen):

```bash
./install.sh
```

Per-platform commands:

```bash
# Web
cd packages/web && pnpm build
cd packages/web && pnpm test

# Terminal (Python)
cd packages/terminal && pip install -e . && pytest

# Apple
cd packages/apple && open Package.swift

# Demo site (local dev)
cd websites && ./run.sh
```

## Design

How this repo is laid out, how it's consumed, and the recipe for building
sibling toolkit repos the same way:
[`docs/repo-pattern.md`](docs/repo-pattern.md).

Consumer setup walkthrough (git submodule path):
[`docs/consuming-as-submodule.md`](docs/consuming-as-submodule.md).

## Planning

Milestones, the open architectural decision, and design notes live in
[`docs/planning/planning.md`](docs/planning/planning.md).

Agent-oriented orientation: [`AGENTS.md`](AGENTS.md).
Repo conventions and build rules: [`.claude/CLAUDE.md`](.claude/CLAUDE.md).
