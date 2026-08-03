# Development Guide

This is a collection of notes and guidelines to help developers work on _Pinpoint V_.

::: tip
Docs are still being built. Come back later!
:::

## Tooling

_Pinpoint V_ is a Single Page Application (SPA) web app. It's intended infrastructure is client-side web browsers, so the tooling is focused on this kind of application.

- **Quasar**: The main framework is [Quasar](https://quasar.dev/) which is an open source framework built on top of [Vue.js](https://vuejs.org/). It provides a component library and several helper features including cross-platform deployment.
- **BabylonJS**: The 3D engine used for rendering the atlases and probes is [Babylon.js](https://www.babylonjs.com/). It provides a web-native graphics engine with plenty of game engine features.
- **BrainGlobe**: Atlas information and format are from the [BrainGlobe Atlas API](https://brainglobe.info/). We use the v3 API.
- **SpikeInterface ProbeInterface Library**: Probe information and format are from [SpikeInterface's ProbeInterface Library](https://github.com/SpikeInterface/probeinterface_library) public GitHub repo host. We fetch data directly from the repo's main branch at runtime.
- **pnpm + Node.js LTS**: For development runtimes, we use [pnpm](https://pnpm.io/) and use the latest [LTS version of Node.js](https://nodejs.org/en).
- **Agent Skills**: For coding agents, a collection of relevant development [skills by Anthony Fu](https://github.com/antfu/skills) have been added in `.agents/skills`. An `AGENTS.md` file also provides extra details.
