import { defineStore } from "pinia";
import { ref } from "vue";
import { Atlas } from "@/features/atlas";

export const useFavoriteAtlasesStore = defineStore(
  "favorite-atlases",
  () => {
    /**
     * Favorites mapping. Source URL -> atlas names.
     */
    const favorites = ref<Record<string, string[]>>({});

    /**
     * Add an atlas to its source's favorites list.
     * @param atlas Atlas to add.
     */
    function add(atlas: Atlas) {
      const list = (favorites.value[atlas.source] ??= []);
      if (!list.includes(atlas.name)) {
        list.push(atlas.name);
      }
    }

    /**
     * Removes an atlas from its source's favorites list.
     *
     * Does nothing if the atlas or source doesn't exist.
     *
     * @param atlas Atlas to remove.
     */
    function remove(atlas: Atlas) {
      // Get the source.
      const sourceList = favorites.value[atlas.source];
      if (!sourceList) return;

      // Remove (all occurrences).
      favorites.value[atlas.source] = sourceList.filter(
        name => name !== atlas.name
      );
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
