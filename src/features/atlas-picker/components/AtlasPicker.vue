<script lang="ts" setup>
import { computed, ref } from "vue";
import { useQuasar } from "quasar";
import { useI18n } from "vue-i18n";
import axios from "axios";
import { useFavoriteAtlasesStore } from "@/stores/favorite-atlases.store";
import { useFuse } from "@vueuse/integrations/useFuse";
import { Atlas } from "@/models/atlas.model";

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

enum ConnectionState {
  Disconnected,
  Connecting,
  Connected
}

// Props.
const selectedAtlas = defineModel<Atlas | null>({ required: true });

// Composables.

const $q = useQuasar();
const { t } = useI18n();
const favoriteAtlasesStore = useFavoriteAtlasesStore();

// State.

/**
 * Atlas source URL.
 */
const atlasSource = ref<string | null>("http://localhost:3000");

/**
 * Connection to source.
 */
const connectionState = ref<ConnectionState>(ConnectionState.Disconnected);

/**
 * Filter string.
 */
const searchQuery = ref<string | null>(null);

/**
 * Full list of atlases from the last connection.
 */
const atlases = ref<Atlas[]>([]);

// Getters.

/**
 * Null unwrapped search query.
 */
const unwrappedSearchQuery = computed(() => searchQuery.value ?? "");

/**
 * Favorites for this source as a set for fast lookup.
 */
const favoritesSet = computed(() => {
  // Return the source if there are atlases.
  if (atlases.value[0]) {
    const source = atlases.value[0].source;
    return new Set(favoriteAtlasesStore.favorites[source]);
  }

  // Otherwise, return the empty set.
  return new Set();
});

/**
 * Fuzzy finding results.
 */
const { results: atlasFuse } = useFuse(unwrappedSearchQuery, atlases, {
  fuseOptions: { keys: ["name"] }
});

/**
 * Switch between showing all atlases sorted or fuzzy finding results.
 */
const filteredAtlases = computed(() =>
  searchQuery.value
    ? atlasFuse.value.map(result => result.item)
    : [...atlases.value].sort((a, b) => a.name.localeCompare(b.name))
);

/**
 * Favorites from this source.
 */
const filteredAtlasesFavorites = computed(() =>
  filteredAtlases.value.filter(atlas => favoritesSet.value.has(atlas.name))
);

/**
 * Non-favorite atlases from this source.
 */
const filteredAtlasesAtlases = computed(() =>
  filteredAtlases.value.filter(atlas => !favoritesSet.value.has(atlas.name))
);

/**
 * Notify if a connection fails and set the connection status to disconnected.
 */
function notifyFail() {
  $q.notify({
    message: t("atlasPicker.connectFailed"),
    caption: t("atlasPicker.connectFailedCaption"),
    color: "negative",
    icon: "mobiledata_off"
  });
  connectionState.value = ConnectionState.Disconnected;
}

/**
 * Make a connection to the atlas source and populate the atlas list.
 */
async function connect() {
  // Disconnect if no source.
  if (!atlasSource.value) {
    connectionState.value = ConnectionState.Disconnected;
    return;
  }

  // Set to connecting.
  connectionState.value = ConnectionState.Connecting;
  const source = atlasSource.value;

  try {
    // Make a connection.
    const response = await axios.get<AtlasSourceResponse>(atlasSource.value);

    // Parse the response.
    if (response.data) {
      atlases.value = response.data.files
        .filter(item => item.type === "folder")
        .map(item => ({ name: item.name, source }));
      connectionState.value = ConnectionState.Connected;
    } else {
      notifyFail();
    }
  } catch (e) {
    notifyFail();
  }
}
</script>

<template>
  <q-form class="q-gutter-y-sm">
    <p class="text-h6">{{ $t("atlasPicker.title") }}</p>

    <div class="row q-gutter-x-md">
      <q-btn
        color="primary"
        icon="public"
        :label="$t('atlasPicker.pinpointAtlases')"
        @click="
          atlasSource =
            'https://virtualbrainlab.alleninstitute.org/pinpoint/atlases'
        "
      />
      <q-btn
        icon="home"
        :label="$t('atlasPicker.locallyHosted')"
        @click="atlasSource = 'http://localhost:3000'"
      />
    </div>

    <q-input
      v-model="atlasSource"
      class="col"
      clearable
      :label="$t('atlasPicker.sourceUrl')"
    />

    <q-btn
      :loading="connectionState === ConnectionState.Connecting"
      color="primary"
      :label="$t('atlasPicker.connect')"
      @click="connect"
    />

    <template v-if="connectionState === ConnectionState.Connected">
      <q-input
        v-model="searchQuery"
        clearable
        :label="$t('atlasPicker.search')"
      >
        <template #prepend>
          <q-icon name="search" />
        </template>
      </q-input>
      <p>{{
        $t(
          "atlasPicker.atlasCount",
          { count: filteredAtlases.length },
          filteredAtlases.length
        )
      }}</p>

      <q-list class="atlas-list" separator>
        <q-item
          v-for="{ name, source } in filteredAtlasesFavorites"
          :key="`${source}-${name}`"
          :active="name === selectedAtlas?.name"
          v-ripple
          clickable
          @click="selectedAtlas = { name, source }"
        >
          <q-item-section>{{ name }}</q-item-section>
          <q-item-section side>
            <q-btn
              flat
              round
              color="pink"
              icon="favorite"
              @click.stop="favoriteAtlasesStore.remove(source, name)"
            />
          </q-item-section>
        </q-item>

        <q-item
          v-for="{ name, source } in filteredAtlasesAtlases"
          :key="`${source}-${name}`"
          :active="name === selectedAtlas?.name"
          v-ripple
          clickable
          @click="selectedAtlas = { name, source }"
        >
          <q-item-section>{{ name }}</q-item-section>
          <q-item-section side>
            <q-btn
              flat
              round
              icon="favorite_border"
              @click.stop="favoriteAtlasesStore.add(source, name)"
            />
          </q-item-section>
        </q-item>
      </q-list>
    </template>
  </q-form>
</template>

<style lang="sass" scoped>
.atlas-list
  max-height: 30vh
  overflow-y: auto
</style>
