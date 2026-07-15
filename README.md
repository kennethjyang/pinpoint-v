# Pinpoint V

[![Deploy](https://github.com/kennethjyang/pinpoint-v/actions/workflows/deploy.yml/badge.svg)](https://github.com/kennethjyang/pinpoint-v/actions/workflows/deploy.yml)
[![Code Quality](https://github.com/kennethjyang/pinpoint-v/actions/workflows/code-quality.yml/badge.svg)](https://github.com/kennethjyang/pinpoint-v/actions/workflows/code-quality.yml)
[![test.yml](https://github.com/kennethjyang/pinpoint-v/actions/workflows/test.yml/badge.svg)](https://github.com/kennethjyang/pinpoint-v/actions/workflows/test.yml)

Next-generation in vivo electrophysiology planning and automation tool.

> [!WARNING]
> Under active and early development. Feel free to poke around and contribute, but this is not a finished product yet.

## Install for development.

1. Install Node.js LTS (currently on 24).
2. Install `pnpm` (currently on 11).
3. Install the Quasar CLI: `pnpm add -g @quasar/cli`
4. Clone and install dependencies using `pnpm install`
5. Run the dev server using `quasar dev`

Lefthook has enabled pre-commit hooks that run the formatter, linter, and type checker.

## Hosting local atlases.

Build atlases using [Atlas Converter](https://github.com/kennethjyang/atlas-converter), which will put them in `~/pinpoint_atlases` by default. Then run:

```bash
pnpm local-atlas
```

to serve them locally.
