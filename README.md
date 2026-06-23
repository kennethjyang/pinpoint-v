# Pinpoint V

Next generation in vivo electrophysiology planning and automation tool.

> [!WARNING]
> Under active and early development. Feel free to poke around and contribute but this is not a finished product yet.

## Install for development.

1. Install Node (we use the latest, currently 26+).
2. (Optional) install `pnpm`.
3. Clone and install dependencies using `npm install`

Lefthook has enabled pre-commit hooks that run the formatter, linter, and type checker.

## Hosting local atlases.

Build atlases using [Atlas Converter](https://github.com/kennethjyang/atlas-converter) which will put them in `~/pinpoint_atlases`. Then run:
```bash
npm run local-atlas
```
to serve them locally.