<script lang="ts" setup>
import { computed, ref } from "vue";
import { useQuasar } from "quasar";
import { useI18n } from "vue-i18n";
import axios from "axios";
import { useFavoriteAtlasesStore } from "@/stores/favorite-atlases.store";
import { useFuse } from "@vueuse/integrations/useFuse";
import {
  Atlas,
  AtlasSourceResponse,
  checkAtlasCompatibility,
  ConverterCompatibility,
  fetchAtlasMetadata,
  parseAtlasSourceResponse
} from "@/features/atlas";

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
      atlases.value = parseAtlasSourceResponse(response.data, source);
      connectionState.value = ConnectionState.Connected;
    } else {
      notifyFail();
    }
  } catch (e) {
    notifyFail();
  }
}

/**
 * Select an atlas, first checking that its version is compatible with the
 * running Pinpoint version. Blocks selection (and notifies) on a major
 * version mismatch or an unverifiable version; warns but still selects on a
 * minor version mismatch.
 */
async function selectAtlas(atlas: Atlas) {
  const metadata = await fetchAtlasMetadata(atlas);
  const compatibility = checkAtlasCompatibility(
    metadata?.version,
    import.meta.env.APP_VERSION
  );

  switch (compatibility) {
    case ConverterCompatibility.BlockPinpointOutdated:
      $q.notify({
        message: t("atlasPicker.pinpointOutdated"),
        caption: t("atlasPicker.pinpointOutdatedCaption"),
        color: "negative",
        icon: "error"
      });
      selectedAtlas.value = null;
      return;
    case ConverterCompatibility.BlockAtlasOutdated:
      $q.notify({
        message: t("atlasPicker.atlasOutdated"),
        caption: t("atlasPicker.atlasOutdatedCaption"),
        color: "negative",
        icon: "error"
      });
      selectedAtlas.value = null;
      return;
    case ConverterCompatibility.Unverifiable:
      $q.notify({
        message: t("atlasPicker.versionUnverifiable"),
        caption: t("atlasPicker.versionUnverifiableCaption"),
        color: "negative",
        icon: "error"
      });
      selectedAtlas.value = null;
      return;
    case ConverterCompatibility.Warn:
      $q.notify({
        message: t("atlasPicker.versionWarn"),
        caption: t("atlasPicker.versionWarnCaption"),
        color: "warning",
        icon: "warning"
      });
      break;
    case ConverterCompatibility.Compatible:
      break;
  }

  selectedAtlas.value = atlas;
}
</script>

<template>
  <q-form class="q-gutter-y-sm">
    <p class="text-h6">{{ $t("atlasPicker.title") }}</p>

    <div class="row q-gutter-x-md">
      <q-btn
        :label="$t('atlasPicker.pinpointAtlases')"
        color="primary"
        icon="public"
        @click="
          atlasSource =
            'https://virtualbrainlab.alleninstitute.org/pinpoint/atlases'
        "
      />
      <q-btn
        :label="$t('atlasPicker.locallyHosted')"
        icon="home"
        @click="atlasSource = 'http://localhost:3000'"
      />
    </div>

    <q-input
      v-model="atlasSource"
      :label="$t('atlasPicker.sourceUrl')"
      class="col"
      clearable
    />

    <q-btn
      :label="$t('atlasPicker.connect')"
      :loading="connectionState === ConnectionState.Connecting"
      color="primary"
      @click="connect"
    />

    <template v-if="connectionState === ConnectionState.Connected">
      <q-input
        v-model="searchQuery"
        :label="$t('atlasPicker.search')"
        clearable
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
          v-for="atlas in filteredAtlasesFavorites"
          :key="`${atlas.source}-${atlas.name}`"
          v-ripple
          :active="selectedAtlas === atlas"
          clickable
          @click="selectAtlas(atlas)"
        >
          <q-item-section>{{ atlas.name }}</q-item-section>
          <q-item-section side>
            <q-btn
              color="pink"
              flat
              icon="favorite"
              round
              @click.stop="favoriteAtlasesStore.remove(atlas)"
            />
          </q-item-section>
        </q-item>

        <q-item
          v-for="atlas in filteredAtlasesAtlases"
          :key="`${atlas.source}-${atlas.name}`"
          v-ripple
          :active="selectedAtlas === atlas"
          clickable
          @click="selectAtlas(atlas)"
        >
          <q-item-section>{{ atlas.name }}</q-item-section>
          <q-item-section side>
            <q-btn
              flat
              icon="favorite_border"
              round
              @click.stop="favoriteAtlasesStore.add(atlas)"
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
