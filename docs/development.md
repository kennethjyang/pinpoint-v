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

## Organization

The code roughly follows _feature-based organization_.

- Source code is listed under `/src`.
- Globally shared elements are in `/src`-level folders.
- Everything else are placed inside scoped `/feature` folders.

Each feature folder contains the components, models, and business logic concerning that one feature.

- `/api`: pure-ish functions that enable behavior for the feature. Called by other scripts in the feature.
- `/components`: Vue Single Component File (SCF) style files using the Composition API. These primarily define the UI of that component and include reactive interfaces that call out to the API to drive functionality.
- `/composables`: Reactive elements that either get reused or encapsulate some local logic used by components. It's sort of a blend between pure functions and UI and are used when the state is tightly couples with reactive state.
- `/models`: Non-behavior code like interfaces and constants.

Test scripts use the `.spec.ts` extension and are co-located with the script they are testing.

### Accessing code

All script files are modules. Meaning members are private to the outside and must be exported. Exported members can be used through **relative imports** within the same feature. However, to be used outside of the feature, it must be re-exported in the feature barrel file `index.ts`. This is the feature's public API.

Other features can use a feature by importing the re-exported members exposed by the barrel file. They should import the feature folder as a module.
