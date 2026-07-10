<script lang="ts" setup>
import { computed, ref } from "vue";
import { useQuasar } from "quasar";
import { useI18n } from "vue-i18n";
import axios from "axios";
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

// Props.
const selectedAtlas = defineModel<string | null>({ required: true });

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
 * Full list of atlases from the last connection.
 */
const atlases = ref<string[]>([]);

// Getters.

/**
 * Null unwrapped search query.
 */
const unwrappedSearchQuery = computed(() => searchQuery.value ?? "");

/**
 * Favorites for this source as a set for fast lookup.
 */
const favoritesSet = computed(
  () => new Set(favoriteAtlasesStore.favorites[connectedSource.value])
);

/**
 * Fuzzy finding results.
 */
const { results: atlasFuse } = useFuse(unwrappedSearchQuery, atlases);

/**
 * Switch between showing all atlases sorted or fuzzy finding results.
 */
const filteredAtlases = computed(() =>
  searchQuery.value
    ? atlasFuse.value.map(result => result.item)
    : [...atlases.value].sort((a, b) => a.localeCompare(b))
);

/**
 * Favorites from this source.
 */
const filteredAtlasesFavorites = computed(() =>
  filteredAtlases.value.filter(atlasName => favoritesSet.value.has(atlasName))
);

/**
 * Non-favorite atlases from this source.
 */
const filteredAtlasesAtlases = computed(() =>
  filteredAtlases.value.filter(atlasName => !favoritesSet.value.has(atlasName))
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
  connectedSource.value = "";
}

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
    const response = await axios.get<AtlasSourceResponse>(atlasSource.value);

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
      :loading="connectedSource === 'connecting'"
      color="primary"
      :label="$t('atlasPicker.connect')"
      @click="connect"
    />

    <template v-if="connectedSource !== '' && connectedSource !== 'connecting'">
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
          v-for="atlasName in filteredAtlasesFavorites"
          :key="`${connectedSource}-${atlasName}`"
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

        <q-item
          v-for="atlasName in filteredAtlasesAtlases"
          :key="`${connectedSource}-${atlasName}`"
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
              @click.stop="favoriteAtlasesStore.add(connectedSource, atlasName)"
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
