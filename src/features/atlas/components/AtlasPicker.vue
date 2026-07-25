<script lang="ts" setup>
import { computed, ref, watch } from "vue";
import { useQuasar } from "quasar";
import { useI18n } from "vue-i18n";
import { useFavoriteAtlasesStore } from "@/stores/favorite-atlases.store";
import { useFuse } from "@vueuse/integrations/useFuse";
import {
  Atlas,
  BRAINGLOBE_BASE_URL,
  checkAtlasCompatibility,
  ConverterCompatibility,
  fetchAtlasMetadata,
  listAtlases,
  listAtlasesHTTP
} from "@/features/atlas";

enum ConnectionState {
  Disconnected,
  Connecting,
  Connected
}

enum SourceToggle {
  BrainGlobe,
  Custom
}

// Props.
const selectedAtlas = defineModel<Atlas | null>({ required: true });

// Composables.

const $q = useQuasar();
const { t } = useI18n();
const favoriteAtlasesStore = useFavoriteAtlasesStore();

// State.

const sourceToggle = ref<SourceToggle>(SourceToggle.BrainGlobe);

watch(sourceToggle, newSource => {
  switch (newSource) {
    case SourceToggle.BrainGlobe:
      atlasSource.value = BRAINGLOBE_BASE_URL;
      break;
    case SourceToggle.Custom:
      atlasSource.value = "http://localhost:3000";
      break;
    default:
      atlasSource.value = BRAINGLOBE_BASE_URL;
      break;
  }
});

/**
 * Atlas source URL.
 */
const atlasSource = ref<string | null>(BRAINGLOBE_BASE_URL);

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
const filteredFavorites = computed(() =>
  filteredAtlases.value.filter(atlas => favoritesSet.value.has(atlas.name))
);

/**
 * Non-favorite atlases from this source.
 */
const filteredNonFavorites = computed(() =>
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

  // Make the connection.
  const fetchedAtlases =
    new URL(atlasSource.value).href === new URL(BRAINGLOBE_BASE_URL).href
      ? await listAtlases()
      : await listAtlasesHTTP(atlasSource.value);
  if (fetchedAtlases) {
    atlases.value = fetchedAtlases;
    connectionState.value = ConnectionState.Connected;
  } else {
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

    <q-btn-toggle
      v-model="sourceToggle"
      :options="[
        {
          label: $t('atlasPicker.brainglobeHosted'),
          value: SourceToggle.BrainGlobe
        },
        { label: $t('atlasPicker.customHTTPHost'), value: SourceToggle.Custom }
      ]"
      spread
      toggle-color="primary"
    />

    <template v-if="sourceToggle === SourceToggle.Custom">
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
    </template>

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

      <q-list class="dialog-list" separator>
        <q-item
          v-for="atlas in filteredFavorites"
          :key="`${atlas.source}-${atlas.name}`"
          v-ripple
          :active="selectedAtlas === atlas"
          clickable
          @click="selectAtlas(atlas)"
        >
          <q-item-section>{{ atlas.name }}</q-item-section>
          <q-item-section side>
            <q-btn
              :aria-label="$t('atlasPicker.removeFavorite')"
              color="pink"
              flat
              icon="favorite"
              round
              @click.stop="favoriteAtlasesStore.remove(atlas)"
            />
          </q-item-section>
        </q-item>

        <q-item
          v-for="atlas in filteredNonFavorites"
          :key="`${atlas.source}-${atlas.name}`"
          v-ripple
          :active="selectedAtlas === atlas"
          clickable
          @click="selectAtlas(atlas)"
        >
          <q-item-section>{{ atlas.name }}</q-item-section>
          <q-item-section side>
            <q-btn
              :aria-label="$t('atlasPicker.addFavorite')"
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
