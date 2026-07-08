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

    return { favorites };
  },
  { persist: true }
);
