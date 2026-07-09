<script lang="ts" setup>
/**
 * @file Atlas picker interface.
 *
 * Handles connecting to an atlas source, picking an atlas, and managing favorites.
 */

import { computed, ref } from "vue";
import { useQuasar } from "quasar";
import { api } from "@/boot/axios.boot";
import { useFavoriteAtlasesStore } from "@/stores/favorite-atlases.store";
import { useFuse } from "@vueuse/integrations/useFuse";

/**
 * Atlas item in response structure.
 */
interface AtlasItem {
  name: string;
  type: string;
}

/**
 * Atlas source connection response.
 */
interface AtlasSourceResponse {
  files: AtlasItem[];
}

// Composables.

const $q = useQuasar();
const favoriteAtlasesStore = useFavoriteAtlasesStore();

// State.

/**
 * Atlas source URL.
 */
const atlasSource = ref<string | null>("http://localhost:3000");

/**
 * Connected source URL.
 *
 * "" = disconnected, "connecting", "<URL>" = connected.
 */
const connectedSource = ref<string>("");

/**
 * Filter string.
 */
const searchQuery = ref<string | null>(null);

/**
 * Actively selected atlas.
 */
const selectedAtlas = ref<string | null>(null);

/**
 * Full list of atlases from the last connection.
 */
const atlases = ref<string[]>([]);

// Getters.

const unwrappedFavorites = computed(
  () => favoriteAtlasesStore.favorites[connectedSource.value] ?? []
);

const nonFavoriteAtlases = computed(() => {
  // Filter out favorites.
  if (unwrappedFavorites.value) {
    return atlases.value.filter(
      atlas => unwrappedFavorites.value.indexOf(atlas) === -1
    );
  }

  // Return whole list if no favorites.
  return atlases.value;
});
const unwrappedSearchQuery = computed(() => searchQuery.value ?? "");

const fuseFavorites = useFuse(unwrappedSearchQuery, unwrappedFavorites);

const fuseAtlases = useFuse(unwrappedSearchQuery, nonFavoriteAtlases);

/**
 * Favorite atlases from this source. Sorted.
 */
const computedFavorites = computed(() => {
  // Extract favorites list for this source.
  const favoritesList = favoriteAtlasesStore.favorites[connectedSource.value];
  if (!favoritesList) return [];

  // Return fuzzy search or sorted search depending on if a query is made.
  return searchQuery.value
    ? fuseFavorites.results.value.map(result => result.item)
    : [...favoritesList].sort((a, b) => a.localeCompare(b));
});

/**
 * Non-favorite atlases from this source.
 */
const computedAtlases = computed(() =>
  searchQuery.value
    ? fuseAtlases.results.value.map(result => result.item)
    : [...nonFavoriteAtlases.value].sort((a, b) => a.localeCompare(b))
);

/**
 * Make a connection to the atlas source and populate the atlas list.
 */
async function connect() {
  // Disconnect if no source.
  if (!atlasSource.value) {
    connectedSource.value = "";
    return;
  }

  // Set to connecting.
  connectedSource.value = "connecting";

  try {
    // Make a connection.
    const response = await api.get<AtlasSourceResponse>(atlasSource.value);

    // Parse the response.
    if (response.data) {
      atlases.value = response.data.files
        .filter(item => item.type === "folder")
        .map(item => item.name);
      connectedSource.value = atlasSource.value;
    } else {
      notifyFail();
    }
  } catch (e) {
    notifyFail();
  }

  /**
   * Notify if a connection fails and set the connection status to disconnected.
   */
  function notifyFail() {
    $q.notify({
      message: "Unable to access atlases from source.",
      caption: "Check source URL and try again.",
      color: "negative",
      icon: "mobiledata_off"
    });
    connectedSource.value = "";
  }
}
</script>

<template>
  <q-form class="q-gutter-y-sm">
    <p class="text-h6">Atlas Source</p>

    <div class="row q-gutter-x-md">
      <q-btn
        color="primary"
        icon="public"
        label="Pinpoint Atlases"
        @click="
          atlasSource =
            'https://virtualbrainlab.alleninstitute.org/pinpoint/atlases'
        "
      />
      <q-btn
        icon="home"
        label="Locally Hosted"
        @click="atlasSource = 'http://localhost:3000'"
      />
    </div>

    <q-input v-model="atlasSource" class="col" clearable label="Source URL" />

    <q-btn
      :loading="connectedSource === 'connecting'"
      color="primary"
      label="Connect"
      @click="connect"
    />

    <template v-if="connectedSource !== '' && connectedSource !== 'connecting'">
      <q-input v-model="searchQuery" clearable label="Search">
        <template v-slot:prepend>
          <q-icon name="search" />
        </template>
      </q-input>
      <p>{{ computedAtlases.length + computedFavorites.length }} atlases</p>

      <q-list class="atlas-list">
        <template v-if="computedFavorites.length > 0">
          <q-item
            v-for="atlasName in computedFavorites"
            :active="atlasName === selectedAtlas"
            v-ripple
            clickable
            @click="selectedAtlas = atlasName"
          >
            <q-item-section>{{ atlasName }}</q-item-section>
            <q-item-section side>
              <q-btn
                flat
                round
                color="pink"
                icon="favorite"
                @click.stop="
                  favoriteAtlasesStore.remove(connectedSource, atlasName)
                "
              />
            </q-item-section>
          </q-item>
          <q-separator />
        </template>

        <template v-if="computedAtlases.length > 0">
          <q-item
            v-for="atlasName in computedAtlases"
            :active="atlasName === selectedAtlas"
            v-ripple
            clickable
            @click="selectedAtlas = atlasName"
          >
            <q-item-section>{{ atlasName }}</q-item-section>
            <q-item-section side>
              <q-btn
                flat
                round
                icon="favorite_border"
                @click.stop="
                  favoriteAtlasesStore.add(connectedSource, atlasName)
                "
              />
            </q-item-section>
          </q-item>
        </template>
      </q-list>
    </template>
  </q-form>
</template>

<style lang="sass" scoped>
.atlas-list
  max-height: 30vh
  overflow-y: auto
</style>
