/**
 * @file Favorite atlases tracking.
 *
 * Primarily used in the atlas picker interface.
 */

import { defineStore } from "pinia";
import { ref } from "vue";

export const useFavoriteAtlasesStore = defineStore(
  "favorite-atlases",
  () => {
    /**
     * Favorites mapping. Source URL -> atlas names.
     */
    const favorites = ref<Record<string, string[]>>({});

    /**
     * Add an atlas to a source's favorites list.
     * @param source Atlas source URL.
     * @param atlasName Atlas name to add.
     */
    function add(source: string, atlasName: string) {
      const list = (favorites.value[source] ??= []);
      if (!list.includes(atlasName)) {
        list.push(atlasName);
      }
    }

    /**
     * Removes an atlas from a source's favorites list.
     *
     * Does nothing if the atlas or source doesn't exist.
     *
     * @param source Atlas source URL.
     * @param atlasName Atlas name to remove.
     */
    function remove(source: string, atlasName: string) {
      // Get the source.
      const sourceList = favorites.value[source];
      if (!sourceList) return;

      // Remove (all occurrences).
      favorites.value[source] = sourceList.filter(atlas => atlas !== atlasName);
    }

    /**
     * Remove all favorites.
     */
    function reset() {
      favorites.value = {};
    }

    return { favorites, add, remove, reset };
  },
  { persist: true }
);
