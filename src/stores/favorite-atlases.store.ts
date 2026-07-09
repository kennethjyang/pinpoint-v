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
      (favorites.value[source] ??= []).push(atlasName);
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

      // Find the atlas.
      const atlasIndex = sourceList.indexOf(atlasName);
      if (atlasIndex < 0) return;

      // Remove.
      sourceList.splice(atlasIndex, 1);
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
