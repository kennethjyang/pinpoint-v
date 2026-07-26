## Development Workflow

- Use pnpm and pnpx instead of npm and npx.
- Only verify using static analysis and unit tests. Use `pnpm lint` and `pnpm typecheck`.
- Ensure tests are up to date. Create tests for missing branches. Run tests after any edits using `pnpm test`.
  - Use `pnpm coverage` to help guide discovery but do not fixate on reaching 100% coverage.
- Ensure user-facing strings are encoded in i18n.
- Use idiomatic and cleaner implementations over obscure but performant code.
- Fan out into multiple agents to help parallelize tasks that can benefit from it.
- Never use relative imports. If a module needs to import something, put it into the feature's barrel file as the public API and import from there.

## Vue 3 `<script setup>` ordering

**Required:** In every Vue 3 `<script setup lang="ts">` block, keep
top-level declarations in this order:

1. Imports
2. Type declarations and module-level constants
3. Vue compiler macros: `defineOptions`, `defineProps`, `defineEmits`,
   `defineModel`, `defineSlots`
4. Dependency injection and composables
5. Reactive state: `ref`, `reactive`, `shallowRef`, etc.
6. Derived state: `computed`
7. Functions and event handlers
8. Reactive effects: `watch`, `watchEffect`
9. Lifecycle hooks: `onMounted`, `onUnmounted`, etc.
10. Public API: `defineExpose`

Within each group, declare a value before anything that uses it.
When this ordering conflicts with valid JavaScript/TypeScript dependency
order, preserve dependency correctness.

Before completing any change to a Vue SFC:

- Check the `<script setup>` declaration order.
- Run the repository lint command.
- Fix all ordering violations introduced or encountered in edited files.

## TypeScript module order

Order declarations consistently:

1. Imports: third-party, then internal; separate import type imports.
2. Exported types: types intentionally exposed by the module.
3. Private types: implementation-only interfaces and type aliases.
4. Constants: group related configuration and path/file constants.
5. Exported functions: order by the public API’s logical usage.
6. Private helpers: place near their primary caller, or after public functions when shared.

Do not export a symbol only for testing. Test through the public API only.

One-off helpers: Inline trivial single-use expressions. Use a module-private sibling function
for non-trivial or domain-named logic. Place module-private sibling functions below their
exported primary caller. Nest a helper only when it meaningfully closes over operation-local state;
do not nest solely to make it private.
