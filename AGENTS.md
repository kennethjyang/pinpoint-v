## Development Workflow

- Use pnpm and pnpx instead of npm
- Load the Hunk skill and use it to annotate your edits. Run `hunk skill path` to get the skill path.
- Only verify using static analysis and unit tests. Use pnpm lint and pnpm typecheck.
- Ensure tests are up to date. Create tests for missing branches. Run tests after any edits using pnpm test.

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
